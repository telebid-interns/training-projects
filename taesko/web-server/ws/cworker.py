import collections
import contextlib
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

exc_handler = ExcHandler()


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
    elif exc.code == 'CS_PEER_NOT_SENDING':
        return None, True
    else:
        return ws.http.utils.build_response(400), True


# noinspection PyUnusedLocal
@exc_handler(SignalReceived)
def handle_signal(exc):
    return ws.http.utils.build_response(503), False


class ConnectionWorker:
    """ Receives/parses requests and sends/encodes back responses.

    Instances of this class MUST be used through a context manager to ensure
    proper clean up of resources.

    """

    def __init__(self, iterable_socket, address, *, auth_scheme, static_files,
                 worker_ctx):
        assert isinstance(iterable_socket, ws.sockets.ClientSocket)
        assert isinstance(address, collections.Container)
        assert isinstance(worker_ctx, collections.Mapping)

        self.sock = iterable_socket
        self.address = address
        self.auth_scheme = auth_scheme
        self.static_files = static_files
        self.status_code_on_abort_depreciated = None
        self.exchanges = []
        self.worker_ctx = worker_ctx
        self.conn_ctx = {
            'start': time.time(),
            'end': None
        }

    @property
    def exchange(self):
        return self.exchanges[-1] if self.exchanges else None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if (not exc_val or
                isinstance(exc_val, ws.sockets.ClientSocketException) and
                exc_val == 'CS_PEER_NOT_SENDING'):
            error_log.debug('Execution successful. Cleaning up worker.')
            self.sock.safely_close()
            return False

        if self.exchange['written']:
            error_log.warning(
                'An exception occurred after worker had sent bytes over '
                'the socket(fileno=%s). Client will receive an invalid '
                'HTTP response.',
                self.sock.fileno()
            )
            self.sock.close(with_shutdown=True, safely=False,
                            pass_silently=True)
            return False

        if exc_handler.can_handle(exc_val):
            response, suppress = exc_handler.handle(exc_val)
            if not response:
                # no need to send back a response
                self.sock.close(with_shutdown=True, pass_silently=False)
                return suppress
        else:
            error_log.exception('Could not handle exception. Client will '
                                'receive a 500 Internal Server Error.')
            response, suppress = ws.http.utils.build_response(500), False

        response.headers['Connection'] = 'close'

        try:
            self.respond(response)
            access_log.log(**self.exchange)
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
        ))

    def process_connection(self, quick_reply_with=None):
        """ Continually serve an http connection.

        :param quick_reply_with: If given will be sent to the client immediately
        as a response without parsing his request.
        :return: This method doesn't return until the connection is closed.
        """
        if quick_reply_with:
            assert isinstance(quick_reply_with, ws.http.structs.HTTPResponse)

            self.push_exchange()
            self.respond(quick_reply_with)
            access_log.log(**self.exchange)

        while True:
            error_log.debug(
                'HTTP Connection is open. Pushing new http exchange '
                'context and parsing request...')
            self.push_exchange()
            with record_rusage(self.exchange):
                request = ws.http.parser.parse(self.sock)
                response = self.handle_request(request)
                response = self.respond(response)
                client_persists = request and request_is_persistent(request)
                server_persists = response and response_is_persistent(response)

                if not (client_persists and server_persists):
                    break
            access_log.log(**self.exchange)

    def handle_request(self, request):
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
                request_stats = self.worker_ctx['request_stats']
                response = ws.serve.worker_status(request_stats=request_stats)
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

        return response

    def respond(self, response=None, *, closing=False):
        """

        :param response: Response object to send to client
        :param closing: Boolean switch whether the http connection should be
            closed after this response.
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

        return response

    def status_codes(self):
        return tuple(e['response'].status_line.status_code
                     for e in self.exchanges if e['response'])

    def generate_stats(self):
        for exchange in self.exchanges:
            stats = {}
            keys = frozenset(['request_time', 'ru_stime', 'ru_utime',
                              'ru_maxrss'])
            for k, v in exchange.items():
                if k in keys:
                    stats[k] = v
            yield stats

    # noinspection PyUnusedLocal
    def handle_termination_depreciated(self, signum, stack_info):
        error_log.info('Parent process requested termination.'
                       ' Cleaning up as much as possible and'
                       ' and sending a service unavailable response')

        # No salvation if bytes have already been sent over the socket
        if self.exchange['written']:
            response = ws.http.utils.build_response(503)
            response.headers['Connection'] = 'close'
            self.respond(response=response)

        # TODO what kind of error is this ?
        # raise PeerError(msg='Parent process requested termination.',
        #                 code='PROCESSING_TIMED_OUT')
        raise RuntimeError('Parent process requested termination.')


@contextlib.contextmanager
def record_rusage(dct):
    dct['request_start'] = time.time()
    rusage_start = resource.getrusage(resource.RUSAGE_SELF)
    start_key = 'ru_{}_start'
    end_key = 'ru_{}_end'
    ru_key = 'ru_{}'
    for keyword in ('utime', 'stime', 'maxrss'):
        val = getattr(rusage_start, ru_key.format(keyword))
        dct[start_key.format(keyword)] = val
    try:
        yield
    finally:
        rusage_end = resource.getrusage(resource.RUSAGE_SELF)
        for keyword in ('utime', 'stime', 'maxrss'):
            key = end_key.format(keyword)
            val = getattr(rusage_end, ru_key.format(keyword))
            dct[key] = val
        dct['request_end'] = time.time()
        dct['request_time'] = dct['request_end'] - dct['request_start']

        for keyword in ('ru_utime', 'ru_stime'):
            dct[keyword] = dct[keyword + '_end'] - dct[keyword + '_start']
