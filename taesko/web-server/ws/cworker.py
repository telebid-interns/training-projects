import collections
import errno
import resource
import time

import ws.auth
import ws.cgi
import ws.http.parser
import ws.http.structs
import ws.http.utils
import ws.ratelimit
import ws.serve
import ws.sockets
from ws.config import config
from ws.err import *
from ws.http.utils import request_is_persistent, response_is_persistent
from ws.logs import error_log, access_log

CLIENT_ERRORS_THRESHOLD = config.getint('http', 'client_errors_threshold')


class ConnectionWorker:
    """ Receives/parses requests and sends/encodes back responses.

    Instances of this class MUST be used through a context manager to ensure
    proper clean up of resources.

    """
    max_exchange_history = CLIENT_ERRORS_THRESHOLD * 2

    def __init__(self, iterable_socket, address, *, auth_scheme, static_files,
                 main_ctx=None):
        if not main_ctx:
            main_ctx = {}

        assert isinstance(iterable_socket, ws.sockets.ClientSocket)
        assert isinstance(address, collections.Container)
        assert isinstance(main_ctx, collections.Mapping)

        self.sock = iterable_socket
        self.address = address
        self.status_code_on_abort_depreciated = None
        self.exchanges = collections.deque(maxlen=self.max_exchange_history)
        self.main_ctx = main_ctx
        self.auth_scheme = auth_scheme
        self.static_files = static_files

    @classmethod
    def work(cls, client_socket, address, *, auth_scheme, static_files,
             main_ctx=None, quick_reply_with=None):
        assert (not quick_reply_with or
                isinstance(quick_reply_with, ws.http.structs.HTTPResponse))

        # noinspection PyBroadException
        worker = cls(client_socket, address, main_ctx=main_ctx,
                     auth_scheme=auth_scheme, static_files=static_files)
        with worker as worker_ctx:
            if quick_reply_with:
                worker_ctx.push_exchange()
                worker_ctx.respond(quick_reply_with, closing=True)
                return tuple([quick_reply_with.status_line.status_code])

            worker_ctx.process_connection()

        return tuple(e['response'].status_line.status_code
                     for e in worker_ctx.exchanges if e['response'])

    @property
    def exchange(self):
        return self.exchanges[-1] if self.exchanges else None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not exc_val:
            error_log.debug('Execution successful. Cleaning up worker.')
            self.sock.safely_close()
            return False

        if self.sock.written:
            error_log.warning(
                'An exception occurred after worker had sent bytes over '
                'the socket(fileno=%s). Client will receive an invalid '
                'HTTP response.',
                self.sock.fileno()
            )
            self.sock.close(with_shutdown=True, safely=False,
                            pass_silently=True)
            return False

        response, suppress = handle_exc(exc_val)

        if not response:
            error_log.exception('Could not handle exception. Client will '
                                'receive a 500 Internal Server Error.')
            response = ws.http.utils.build_response(500)

        response.headers['Connection'] = 'close'

        try:
            self.respond(response)
        except OSError as e:
            error_log.warning('During cleanup of worker tried to respond to '
                              'client and close the connection but: '
                              'caught OSError with ERRNO=%s and MSG=%s',
                              e.errno, e.strerror)

            if e.errno == errno.ECONNRESET:
                error_log.warning('Client stopped listening prematurely.'
                                  ' (no Connection: close header was received)')
                return suppress
            else:
                raise
        finally:
            self.sock.close(with_shutdown=True, safely=True, pass_silently=True)

        return suppress

    def push_exchange(self):
        self.exchanges.append(dict(
            request=None,
            response=None,
            written=False,
            request_start=time.time(),
            parse_time=None,
            response_time=None
        ))

    def process_connection(self):
        """ Continually serve an http connection.

        :param request_handler: Per-request handler. Will be called with a
            request object as a single argument. The return value must be a
            response object that will be sent to the client.
        :return: This method doesn't return until the connection is closed.
        """
        while True:
            error_log.debug(
                'HTTP Connection is open. Pushing new http exchange '
                'context and parsing request...')
            self.push_exchange()
            try:
                request = ws.http.parser.parse(self.sock)
            except ws.sockets.ClientSocketException as err:
                if err.code == 'CS_PEER_NOT_SENDING':
                    error_log.info("Client shutdown the socket without sending "
                                   "a Connection: close header.")
                    break
                else:
                    raise
            self.exchange['request'] = request
            self.exchange['parse_time'] = (time.time() -
                                           self.exchange['request_start'])
            auth_check = self.auth_scheme.check(request=request,
                                                address=self.address)
            is_authorized, auth_response = auth_check

            route = request.request_line.request_target.path
            method = request.request_line.method
            error_log.debug3('Incoming request {} {}'.format(method, route))

            if not is_authorized:
                response = auth_response
            elif method == 'GET':
                if ws.serve.is_status_route(route):
                    response = ws.serve.status()
                else:
                    static_response = self.static_files.get_route(route)
                    if static_response.status_line.status_code == 200:
                        response = static_response
                    elif ws.cgi.can_handle_request(request):
                        response = ws.cgi.execute_script(request, self.sock)
                    else:
                        response = ws.http.utils.build_response(404)
            elif ws.cgi.can_handle_request(request):
                response = ws.cgi.execute_script(request, self.sock)
            else:
                response = ws.http.utils.build_response(405)

            self.respond(response)

            client_persists = request and request_is_persistent(request)
            server_persists = response and response_is_persistent(response)

            if not (client_persists and server_persists):
                break

    def respond(self, response=None, *, closing=False):
        """

        :param response: Response object to send to client
        :param closing: Boolean switch whether the http connection should be
            closed after this response.
        :return:
        """
        assert isinstance(closing, bool)

        self.exchange['response'] = response

        if response:
            assert isinstance(response, ws.http.structs.HTTPResponse)

            if closing:
                response.headers['Connection'] = 'close'
            elif (self.exchange['request'] and
                  'Connection' not in response.headers and
                  'Connection' in self.exchange['request'].headers):
                request_headers = self.exchange['request'].headers

                try:
                    conn_value = str(request_headers['Connection'],
                                     encoding='ascii')
                except UnicodeDecodeError:
                    response.headers['Connection'] = 'close'
                else:
                    response.headers['Connection'] = conn_value

            self.exchange['written'] = True
            for chunk in response.iter_chunks():
                self.sock.send_all(chunk)

        post_send_time = time.time()
        if self.exchange['request_start']:
            self.exchange['response_time'] = (post_send_time -
                                              self.exchange['request_start'])
        if self.main_ctx:
            self.exchange['total_time'] = (post_send_time -
                                           self.main_ctx['worker_start'])

        try:
            rusage = resource.getrusage(resource.RUSAGE_SELF)
            self.exchange['ru_utime'] = rusage.ru_utime
            self.exchange['ru_stime'] = rusage.ru_stime
            self.exchange['ru_maxrss'] = rusage.ru_maxrss
        except OSError as err:
            error_log.warning('Cannot record resource usage because '
                              'getrusage() failed with ERRNO=%s and MSG=%s',
                              err.errno, err.strerror)

        access_log.log(**self.exchange)

    # noinspection PyUnusedLocal
    def handle_termination_depreciated(self, signum, stack_info):
        error_log.info('Parent process requested termination.'
                       ' Cleaning up as much as possible and'
                       ' and sending a service unavailable response')

        # No salvation if bytes have already been sent over the socket
        if not self.exchange['written']:
            response = ws.http.utils.build_response(503)
            response.headers['Connection'] = 'close'
            self.respond(response=response)

        # TODO what kind of error is this ?
        # raise PeerError(msg='Parent process requested termination.',
        #                 code='PROCESSING_TIMED_OUT')
        raise RuntimeError('Parent process requested termination.')


# noinspection PyUnusedLocal
@exc_handler(AssertionError)
def server_err_handler(exc):
    error_log.exception('Internal server error.')
    return ws.http.utils.build_response(500), True


# noinspection PyUnusedLocal
@exc_handler(PeerError)
def peer_err_handler(exc):
    error_log.warning('PeerError occurred. msg={exc.msg} code={exc.code}'
                      .format(exc=exc))
    return ws.http.utils.build_response(400), True


@exc_handler(ws.http.parser.ParserException)
def handle_parse_err(exc):
    error_log.warning('Parsing error with code=%s occurred', exc.code)
    return ws.http.utils.build_response(400), True


@exc_handler(ws.sockets.ClientSocketException)
def handle_client_socket_err(exc):
    error_log.warning('Client socket error with code=%s occurred', exc.code)
    if exc.code in ('CS_PEER_SEND_IS_TOO_SLOW', 'CS_CONNECTION_TIMED_OUT'):
        return ws.http.utils.build_response(408), True
    else:
        return ws.http.utils.build_response(400), True


# noinspection PyUnusedLocal
@exc_handler(SignalReceived)
def handle_signal(exc):
    return ws.http.utils.build_response(503), False

