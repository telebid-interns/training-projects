import collections
import errno
import signal

import ws.http.parser
import ws.http.structs
import ws.http.utils
import ws.responses
import ws.serve
import ws.sockets
from ws.logs import error_log, access_log


class Worker:
    """ Receives/parses requests and sends/encodes back responses.

    Instances of this class MUST be used through a context manager to ensure
    proper clean up of resources.

    The methods self.parse_request() and self.respond() MUST only be used
    when the property self.http_connection_is_open is True.

    Persistent connections are handled, but require self.parse_request() to be
    repeatedly called.
    """

    # noinspection PyUnusedLocal
    def __init__(self, iterable_socket, address):
        assert isinstance(iterable_socket, ws.sockets.ClientSocket)
        self.sock = iterable_socket
        self.last_request = None
        self.last_response = None
        self.responding = False
        self.request_queue = collections.deque()

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

        if not self.last_request or not self.last_response:
            return True

        return (not server_closed_connection(self.last_response) and
                ws.http.utils.request_is_persistent(self.last_request))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not exc_val:
            error_log.info('Cleaning up worker after successful execution.')
            self.sock.shutdown(ws.sockets.SHUT_RDWR)
            self.sock.close()
            return False

        error_log.info('Cleaning up worker after unsuccessful execution.')
        if self.responding:
            error_log.exception(
                'An exception occurred after worker had sent bytes over'
                ' the socket. Client will receive an invalid HTTP response.'
            )
            error_log.info('Shutting down socket %d for both r/w',
                           self.sock.fileno())
            self.sock.shutdown(ws.sockets.SHUT_RDWR)
            self.sock.close()
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

        ignored_request = isinstance(exc_val, (ws.sockets.ClientSocketError,
                                               ws.http.parser.ParserError))

        try:
            self.respond(response, ignored_request=ignored_request)
        except OSError as e:
            error_log.critical('Caught OSError with errno %d', e.errno)
            if e.errno == errno.ECONNRESET:
                error_log.warning('Client stopped listening prematurely.'
                                  ' (no Connection: close header was received)')
                self.sock.close()
                return True
            else:
                raise

        error_log.debug('Shutting down and closing client socket %d',
                        self.sock.fileno())
        # TODO the socket needs to be shutdown for reading as well, but
        # only after the client has received this response ?
        try:
            self.sock.shutdown(ws.sockets.SHUT_WR)
        except OSError as e:
            if e.errno == errno.ENOTCONN:
                error_log.warning('Got ENOTCONN when shutting down socket.')
            else:
                raise
        self.sock.close()

        return True

    def parse_request(self):
        assert self.http_connection_is_open

        self.last_request = ws.http.parser.parse(self.sock)
        self.last_response = None

        return self.last_request

    def respond(self, response, *, closing=False, ignored_request=False):
        assert isinstance(response, ws.http.structs.HTTPResponse)
        assert isinstance(closing, bool)
        assert isinstance(ignored_request, bool)
        assert self.http_connection_is_open

        # TODO there needs to be a way to send Close connection through here.
        # instead of timing out and getting terminated.
        if closing:
            response.headers['Connection'] = 'close'

        self.responding = True
        self.last_response = response
        self.sock.send_all(bytes(response))
        self.responding = False

        if ignored_request:
            access_log.log(request=None, response=response)
        else:
            access_log.log(request=self.last_request, response=response)

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
    with Worker(client_socket, address) as worker:
        if quick_reply_with:
            # TODO if the data from the socket is not read through recv()
            # sending data and then quickly doing shutdown() + close()
            # may cause the peer to not receive the response
            # (this can be seen when running ab with large number of requests.)
            worker.parse_request()
            worker.respond(quick_reply_with, closing=True,
                           ignored_request=True)
            return

        while worker.http_connection_is_open:
            error_log.info('HTTP Connection is open. Parsing request...')
            # TODO client's connection might drop while recv()
            # no need to send him a response
            request = worker.parse_request()
            response = handle_request(request)
            worker.respond(response)


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
