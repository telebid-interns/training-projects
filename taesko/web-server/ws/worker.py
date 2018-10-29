import collections

import ws.auth
import ws.cworker
import ws.sockets
from ws.err import *
from ws.logs import error_log
from ws.config import config


class Worker:
    def __init__(self, fd_transport, parent_ctx):
        assert isinstance(fd_transport, ws.sockets.FDTransport)
        self.client_sockets = collections.deque()
        self.parent_ctx = parent_ctx
        self.fd_transport = fd_transport
        self.fd_transport.mode = 'receiver'

    def recv_new_sockets(self):
        error_log.debug('Receiving new sockets trough fd transport.')

        msg, fds = self.fd_transport.recv_fds()

        for fd in fds:
            cs = ws.sockets.ClientSocket.fromfd(
                fd,
                socket_timeout=config.getint('http', 'request_timeout'),
                connection_timeout=config.getint('http', 'connection_timeout')
            )
            self.client_sockets.append(cs)

    def work(self):
        error_log.info('Entering endless loop of processing sockets.')
        while True:
            # noinspection PyBroadException
            try:
                if not self.client_sockets:
                    self.recv_new_sockets()

                cs = self.client_sockets.pop(0)
                ws.cworker.work(
                    client_socket=cs,
                    address=cs.getpeername(),
                    auth_scheme=ws.auth.BasicAuth
                )
            except:
                error_log.exception('Unhandled error occurred inside loop.')
                continue
