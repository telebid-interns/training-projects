import collections
import errno
import resource
import signal
import time

import ws.cgi
import ws.http.parser
import ws.http.structs
import ws.http.utils
import ws.ratelimit
import ws.serve
import ws.sockets
from ws.config import config
from ws.err import *
from ws.logs import error_log, access_log

CLIENT_ERRORS_THRESHOLD = config.getint('http', 'client_errors_threshold')
HTTPExchange = collections.namedtuple('HTTPExchange', ['request', 'response'])


# noinspection PyAttributeOutsideInit
class Worker:
    """ Receives/parses requests and sends/encodes back responses.

    Instances of this class MUST be used through a context manager to ensure
    proper clean up of resources.

    The methods self.parse_request() and self.respond() MUST only be used
    when the property self.http_connection_is_open is True.

    Persistent connections are handled, but require self.parse_request() to be
    repeatedly called.
    """
    max_exchange_history = CLIENT_ERRORS_THRESHOLD * 2

    def __init__(self, iterable_socket, address):
        assert isinstance(iterable_socket, ws.sockets.ClientSocket)
        self.sock = iterable_socket
        self.address = address
        self.status_code_on_abort = None
        self.exchanges = collections.deque(maxlen=self.max_exchange_history)
        self.request_start = None
        self.parse_time = None

        signal.signal(signal.SIGTERM, self.handle_termination)

    @property
    def request(self):
        try:
            return self.exchanges[-1].request
        except IndexError:
            return None

    @request.setter
    def request(self, http_request):
        try:
            self.exchanges[-1] = HTTPExchange(http_request,
                                              self.exchanges[-1].response)
        except IndexError:
            self.exchanges.append(HTTPExchange(http_request, None))

    @property
    def response(self):
        try:
            return self.exchanges[-1].response
        except IndexError:
            return None

    @response.setter
    def response(self, http_response):
        try:
            self.exchanges[-1] = HTTPExchange(self.exchanges[-1].request,
                                              http_response)
        except IndexError:
            self.exchanges.append(HTTPExchange(None, http_response))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not exc_val:
            error_log.info('Execution successful. Cleaning up worker.')
            self.sock.close(with_shutdown=True, safely=True)
            return False

        error_log.info('Execution failed. Cleaning up worker.')

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
        else:
            pass

        response = handle_exc(exc_val)

        if not response:
            error_log.exception('Could not handle exception. Client will '
                                'receive a 500 Internal Server Error.')
            response = ws.http.utils.build_response(500)

        response.headers['Connection'] = 'close'

        self.status_code_on_abort = response.status_line.status_code

        ignored_request = isinstance(exc_val, (ws.sockets.ClientSocketException,
                                               ws.http.parser.ParserException))

        try:
            self.respond(response, ignored_request=ignored_request)
        except OSError as e:
            error_log.warning('During cleanup of worker tried to respond to '
                              'client and close the connection but: '
                              'caught OSError with errno %d.', e.errno)

            if e.errno == errno.ECONNRESET:
                error_log.warning('Client stopped listening prematurely.'
                                  ' (no Connection: close header was received)')
                return True
            else:
                raise
        finally:
            self.sock.close(with_shutdown=True, safely=True, pass_silently=True)

        return True

    def process_connection(self, request_handler):
        """ Continually serve an http connection.

        :param request_handler: Per-request handler. Will be called with a
            request object as a single argument. The return value must be a
            response object that will be sent to the client.
        :return: This method doesn't return until the connection is closed.
        """
        while True:
            error_log.debug('HTTP Connection is open. Parsing request...')
            self.exchanges.append(HTTPExchange(None, None))
            self.sock.written = False

            self.request_start = time.time()
            request_iterator = ws.http.parser.SpyIterator(self.sock)

            try:
                self.request = ws.http.parser.parse(request_iterator)
            except ws.sockets.ClientSocketException:
                if request_iterator.iterated_count == 0:
                    error_log.info("Client shutdown the socket without sending "
                                   "a Connection: close header.")
                    break

                raise
            self.parse_time = time.time() - self.request_start

            handler_result = request_handler(self.request, self.sock)
            self.respond(handler_result)

            if not (ws.http.utils.request_is_persistent(self.request) and
                    ws.http.utils.response_is_persistent(self.response)):
                break

    def send_raw_response(self, bytes_iterable):
        assert isinstance(bytes_iterable, collections.Iterable)

    def respond(self, response=None, *, closing=False, ignored_request=False):
        """

        :param response: Response object to send to client
        :param closing: Boolean switch whether the http connection should be
            closed after this response.
        :param ignored_request: Boolean flag whether the request sent from the
            client was not read through the socket. (this will imply that an
            empty request string ("") will be sent to the access.log)
        :return:
        """
        if response:
            assert isinstance(response, ws.http.structs.HTTPResponse)
        assert isinstance(closing, bool)
        assert isinstance(ignored_request, bool)

        if closing:
            response.headers['Connection'] = 'close'
        elif not ignored_request:
            conn = str(self.request.headers.get('Connection', b''),
                       encoding='ascii')

            if conn:
                response.headers['Connection'] = conn

        self.response = response
        if self.response:

            for chunk in self.response.iter_chunks():
                self.sock.send_all(chunk)

        if self.request_start:
            response_time = time.time() - self.request_start
        else:
            response_time = '-'

        try:
            rusage = resource.getrusage(resource.RUSAGE_SELF)
            ru_utime = rusage.ru_utime
            ru_stime = rusage.ru_stime
            ru_maxrss = rusage.ru_maxrss
        except OSError:
            ru_utime = '-'
            ru_stime = '-'
            ru_maxrss = '-'

        access_log.log(request=self.request,
                       response=self.response,
                       ru_utime=ru_utime,
                       ru_stime=ru_stime,
                       ru_maxrss=ru_maxrss,
                       response_time=response_time,
                       parse_time=self.parse_time or '-')

    # noinspection PyUnusedLocal
    def handle_termination(self, signum, stack_info):
        if signum != signum.SIGTERM:
            error_log.warning('SIGTERM handler received signal %s', signum)
            return

        error_log.info('Parent process requested termination.'
                       ' Cleaning up as much as possible and'
                       ' and sending a service unavailable response')

        # No salvation if bytes have already been sent over the socket
        if not self.sock.written:
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
    return ws.http.utils.build_response(500)


@exc_handler(ws.http.parser.ParserException)
def handle_parse_err(exc):
    error_log.warning('Parsing error with code=%s occurred', exc.code)
    return ws.http.utils.build_response(400)


@exc_handler(ws.sockets.ClientSocketException)
def handle_client_socket_err(exc):
    error_log.warning('Client socket error with code=%s occurred', exc.code)
    if exc.code in ('CS_PEER_SEND_IS_TOO_SLOW', 'CS_CONNECTION_TIMED_OUT'):
        return ws.http.utils.build_response(408)
    else:
        return ws.http.utils.build_response(400)


def work(client_socket, address, quick_reply_with=None):
    assert isinstance(client_socket, ws.sockets.ClientSocket)
    assert isinstance(address, collections.Container)
    assert (not quick_reply_with or
            isinstance(quick_reply_with, ws.http.structs.HTTPResponse))

    # noinspection PyBroadException
    try:
        with Worker(client_socket, address) as worker:
            if quick_reply_with:
                worker.respond(quick_reply_with, closing=True,
                               ignored_request=True)
                return 0

            worker.process_connection(request_handler=handle_request)
    except Exception:
        error_log.exception('Worker of address %s finished abruptly.',
                            address)
        return 1

    codes = (e.response.status_line.status_code
             for e in worker.exchanges if e.response)
    err_count = sum(c in ws.ratelimit.CONSIDERED_CLIENT_ERRORS for c in codes)

    if err_count:
        return ws.ratelimit.RATE_LIMIT_EXIT_CODE_OFFSET + err_count
    else:
        return 0


def handle_request(request, client_socket):
    route = request.request_line.request_target.path

    if ws.cgi.can_handle_request(request):
        error_log.debug2('Request will be handled through a CGI script.')
        return ws.cgi.execute_script(request, client_socket)
    elif request.request_line.method == 'GET':
        error_log.debug2('Request did not route to any CGI script.')
        return ws.serve.get_file(route)
    else:
        return ws.http.utils.build_response(405)
