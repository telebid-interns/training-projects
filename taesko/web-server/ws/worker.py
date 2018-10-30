import collections
import ssl

import ws.auth
import ws.cworker
import ws.http.utils as hutils
import ws.ratelimit
import ws.sockets
from ws.config import config
from ws.logs import error_log


class Worker:
    def __init__(self, fd_transport, parent_ctx=None):
        parent_ctx = parent_ctx or {}

        assert isinstance(fd_transport, ws.sockets.FDTransport)
        assert isinstance(parent_ctx, collections.Mapping)

        self.client_sockets = collections.deque()
        self.parent_ctx = parent_ctx
        self.fd_transport = fd_transport
        self.auth_scheme = ws.auth.BasicAuth()
        self.rate_controller = ws.ratelimit.HTTPRequestRateController()
        if config.getboolean('settings', 'ssl_enabled'):
            cert_file = config['settings']['ssl_cert_file']
            self.ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            self.ssl_ctx.load_cert_chain(certfile=cert_file)
        else:
            self.ssl_ctx = None

    def recv_new_sockets(self):
        error_log.debug3('Receiving new sockets through fd transport.')

        msg, fds = self.fd_transport.recv_fds()

        for fd in fds:
            cs = ws.sockets.ClientSocket.fromfd(
                fd,
                ssl_ctx=self.ssl_ctx
            )
            self.client_sockets.append((cs, cs.getpeername()))
            error_log.debug3('Received file descriptor %s', fd)

    def work(self):
        error_log.info('Entering endless loop of processing sockets.')

        while True:
            # noinspection PyBroadException
            try:
                if not self.client_sockets:
                    self.recv_new_sockets()

                cs, address = self.client_sockets.popleft()
                self.handle_client(client_socket=cs, address=address)
            except Exception:
                error_log.exception('Exception occurred in work() loop.')
                continue
            except KeyboardInterrupt:
                break

        try:
            self.fd_transport.discard()
        except OSError:
            pass

        for cs, address in self.client_sockets:
            # noinspection PyBroadException
            try:
                self.handle_client(client_socket=cs,
                                   address=address,
                                   quick_reply_with=hutils.build_response(503))
            except Exception:
                continue
            finally:
                cs.close(pass_silently=True)

        return 0

    def handle_client(self, client_socket, address, quick_reply_with=None):
        assert isinstance(client_socket, ws.sockets.ClientSocket)
        assert isinstance(address, collections.Sequence)

        if self.rate_controller.is_banned(address[0]):
            client_socket.close()
            return

        status_codes = ws.cworker.work(
            client_socket=client_socket,
            address=address,
            auth_scheme=self.auth_scheme,
            quick_reply_with=quick_reply_with
        )
        self.rate_controller.record_handled_connection(
            ip_address=address[0],
            status_codes=status_codes
        )
