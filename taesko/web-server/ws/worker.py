import collections
import errno
import signal
import enum
import functools

import ws.http.parser
import ws.http.structs
import ws.http.utils
import ws.responses
import ws.serve
import ws.sockets
from ws.logs import error_log, access_log
from ws.config import config

bad_requests_threshold = config.getint('http',
                                       'bad_requests_rate_limit_threshold')


HTTPExchange = collections.namedtuple('HTTPExchange', ['request', 'response'])


class ExitCodes(enum.Enum):
    success = 0
    execution_ended_abruptly = 1
    too_many_client_errors = 40


class Worker:
    """ Receives/parses requests and sends/encodes back responses.

    Instances of this class MUST be used through a context manager to ensure
    proper clean up of resources.

    The methods self.parse_request() and self.respond() MUST only be used
    when the property self.http_connection_is_open is True.

    Persistent connections are handled, but require self.parse_request() to be
    repeatedly called.
    """
    max_exchange_history = bad_requests_threshold * 2

    # noinspection PyUnusedLocal
    def __init__(self, iterable_socket, address):
        assert isinstance(iterable_socket, ws.sockets.ClientSocket)
        self.sock = iterable_socket
        self.responding = False
        self.status_code_on_abort = None
        self.exchanges = collections.deque(maxlen=self.max_exchange_history)

        signal.signal(signal.SIGTERM, self.handle_termination)

    @property
    def http_connection_is_open(self):
        def server_closed_connection(response):
            if not response:
                return False
            elif 'Connection' not in response.headers:
                return False
            else:
                pass

            c = response.headers['Connection']
            hop_by_hop_headers = (h.strip() for h in c.split(','))

            return b'close' in hop_by_hop_headers

        if not self.request or not self.response:
            return True

        return (not server_closed_connection(self.response) and
                ws.http.utils.request_is_persistent(self.request))

    @property
    def request(self):
        try:
            return self.exchanges[-1].request
        except IndexError:
            return None

    @request.setter
    def request(self, http_request):
        self.exchanges[-1] = HTTPExchange(http_request,
                                          self.exchanges[-1].response)

    @property
    def response(self):
        try:
            return self.exchanges[-1].response
        except IndexError:
            return None

    @response.setter
    def response(self, http_response):
        self.exchanges[-1] = HTTPExchange(self.exchanges[-1].request,
                                          http_response)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not exc_val:
            error_log.info('Cleaning up worker after successful execution.')
            self.sock.close(with_shutdown=True, safely=True)
            return False

        error_log.info('Cleaning up worker after unsuccessful execution.')
        if self.responding:
            error_log.warning(
                'An exception occurred after worker had sent bytes over '
                'the socket(fileno=%s). Client will receive an invalid '
                'HTTP response.',
                self.sock.fileno()
            )
            self.sock.close(with_shutdown=True, safely=False)
            return False
        else:
            pass

        # server_err_response always returns a response regardless
        # of config, so we need to check for client_err
        if not ws.responses.client_err_response(exc_val):
            error_log.exception('Server error occurred. ')

        response = (ws.responses.client_err_response(exc_val) or
                    ws.responses.server_err_response(exc_val))
        response.headers['Connection'] = 'close'

        self.status_code_on_abort = response.status_line.status_code

        ignored_request = isinstance(exc_val, (ws.sockets.ClientSocketError,
                                               ws.http.parser.ParserError))

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
            self.sock.close(with_shutdown=True, safely=True)

        return True

    def work(self, request_handler):
        """ Continually serve an http connection.

        :param request_handler: Per-request handler. Will be called with a
            request object as a single argument. The return value must be a
            response object that will be sent to the client.
        :return: This method doesn't return until the connection is closed.
        """
        while self.http_connection_is_open:
            error_log.info('HTTP Connection is open. Parsing request...')
            # TODO client's connection might drop while recv()
            # no need to send him a response
            self.exchanges.append(HTTPExchange(None, None))
            self.request = ws.http.parser.parse(self.sock)
            self.response = request_handler(self.request)
            self.respond(self.response)

    def respond(self, response, *, closing=False, ignored_request=False):
        """

        :param response: Response object to send to client.
        :param closing: Boolean switch whether the http connection should be
            closed after this response.
        :param ignored_request: Boolean flag whether the request sent from the
            client was not read through the socket. (this will imply that an
            empty request string ("") will be sent to the access.log)
        :return:
        """
        assert isinstance(response, ws.http.structs.HTTPResponse)
        assert isinstance(closing, bool)
        assert isinstance(ignored_request, bool)
        assert self.http_connection_is_open

        # TODO there needs to be a way to send Close connection through here.
        # instead of timing out and getting terminated.
        if closing:
            response.headers['Connection'] = 'close'
        elif not ignored_request:
            c_headers = str(self.request.headers.get('Connection', b''),
                            encoding='ascii')
            response.headers['Connection'] = c_headers

        self.responding = True
        self.response = response
        self.sock.send_all(bytes(response))
        self.responding = False

        if ignored_request:
            access_log.log(request=None, response=response)
        else:
            access_log.log(request=self.request,
                           response=response)

    # noinspection PyUnusedLocal
    def handle_termination(self, signum, stack_info):
        assert signum == signal.SIGTERM

        error_log.info('Parent process requested termination.'
                       ' Cleaning up as much as possible and'
                       ' and sending a service unavailable response')

        # No salvation if bytes have already been sent over the socket
        assert not self.responding

        response = ws.responses.service_unavailable
        response.headers['Connection'] = 'close'
        self.sock.send_all(bytes(response))

        # TODO what kind of error is this ?
        # raise PeerError(msg='Parent process requested termination.',
        #                 code='PROCESSING_TIMED_OUT')
        raise RuntimeError('Parent process requested termination.')


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
                return

            worker.work(request_handler=handle_request)
    except Exception:
        error_log.exception('Worker on socket %s and address %s finished'
                            ' abruptly.', client_socket.fileno(), address)
        return ExitCodes.execution_ended_abruptly

    codes = (e.response.status_line.status_code
             for e in worker.exchanges if e.response)
    client_err_count = sum(1 for c in codes if 400 <= c < 500)

    if client_err_count > bad_requests_threshold:
        return ExitCodes.too_many_client_errors
    else:
        return ExitCodes.success


def handle_request(request):
    route = request.request_line.request_target.path

    if request.request_line.method == 'GET':
        return ws.serve.get_file(route)
    elif request.request_line.method == 'POST':
        encoding = request.headers.get('Content-Encoding', 'utf-8')
        body = request.body
        return ws.serve.upload_file(route=route, body_stream=body,
                                    encoding=encoding)
    elif request.request_line.method == 'DELETE':
        return ws.serve.delete_file(route)
    else:
        return ws.responses.method_not_allowed
