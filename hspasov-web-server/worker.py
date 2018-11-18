import socket
import select
from log import log, TRACE, DEBUG
from client_connection import ClientConnection


class Worker:
    def __init__(self):
        log.error(TRACE)

        self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._poll = select.poll()
        self._conn_fds = []

    def start(self):
        log.error(TRACE)

        self._poll.register(self._socket, socket.POLLIN)

        while True:
            action_requests = self._poll.poll()

            for fd, event in action_requests:
                if fd is self._socket and event is socket.POLLIN:
                    self.accept()

        self._conn_fd = self.accept()

    def accept(self):
        log.error(TRACE)

        conn, addr = self._socket.accept()
        log.error(TRACE, msg='connection accepted')
        log.error(DEBUG, var_name='conn', var_value=conn)
        log.error(DEBUG, var_name='addr', var_value=addr)

        self._poll.register(conn, socket.POLLIN)

        return ClientConnection(conn, addr)

    def stop(self):
        log.error(TRACE)
        ...
