import collections
import logging
import os
import socket
import time

import ws.http.parser
import ws.serve
from ws.config import config
from ws.err import *

error_log = logging.getLogger('error')


class RequestReceiver:
    buffer_size = 2048

    def __init__(self, sock):
        self.sock = sock
        self.chunks = []
        self.current_chunk = None
        self.socket_broke = False

    def __iter__(self):
        return self

    def __next__(self):
        if self.current_chunk:
            try:
                return next(self.current_chunk)
            except StopIteration:
                pass
        elif self.socket_broke:
            raise StopIteration()

        chunk = self.sock.recv(self.__class__.buffer_size)
        error_log.debug('Read chunk %s', chunk)

        if chunk == b'':
            error_log.critical('Socket %s broke', self.sock)
            self.socket_broke = True
            raise StopIteration()
            # raise ws.err.PeerError(code='BROKEN_SOCKET',
            #                        msg='Client send 0 bytes through socket.')

        self.chunks.append(chunk)
        self.current_chunk = iter(chunk)

        return next(self.current_chunk)

    def recv_until_body(self):
        last_four = collections.deque(maxlen=4)
        for b in self:
            last_four.append(b)

            if bytes(last_four) == b'\r\n\r\n':
                error_log.debug('Received request headers.')
                break
        else:
            raise PeerError(msg='HTTP request has no trailing CR-LF-CR-LF',
                            code='REQUEST_HAS_NO_END')


class Server:
    ActiveWorker = collections.namedtuple('ActiveWorker', ['pid', 'created_on'])

    def __init__(self):
        self.host = config['settings']['host']
        self.port = config.getint('settings', 'port')
        self.timeout = config.getint('settings', 'request_timeout')
        self.concurrency = config.getint('settings', 'max_concurrent_requests')

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.workers = collections.deque()

    def listen(self):
        error_log.debug('Listening...')
        self.sock.listen(self.concurrency)

        while True:
            client_socket, address = self.sock.accept()
            error_log.debug('Accepted connection. '
                            'client_socket=%s and address=%s',
                            client_socket, address)
            child_pid = os.fork()  # TODO not always child_pid name

            if child_pid == 0:
                error_log.debug('Closing listening socket in child.')
                return client_socket, address
            else:
                error_log.info('Spawned child process with pid %d', child_pid)
                error_log.debug('Closing client socket in parent process')

                client_socket.close()
                self.workers.append(self.ActiveWorker(pid=child_pid,
                                                      created_on=time.time()))
                # TODO this might raise OSError
                finished = os.wait3(os.WNOHANG)
                pid = finished[0]

                if pid:
                    old_len = len(self.workers)

                    for i, w in enumerate(self.workers):
                        if w.pid == pid:
                            del self.workers[i]
                            error_log.info('Popped worker %s', w)
                            break

                    assert old_len != len(self.workers)

    def __enter__(self):
        error_log.debug('Binding server on %s:%s', self.host, self.port)
        self.sock.bind((self.host, self.port))

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not exc_type:
            error_log.info("Closing server's leftover listening socket")
            self.sock.close()
            return False

        error_log.exception('Unhandled error while listening.'
                            'Shutting down...')
        error_log.info("Closing server's listening socket")

        self.sock.close()

        if self.workers:
            error_log.info('%d child process found. Waiting completion',
                           len(self.workers))
            os.wait()

        return False


def handle_connection(sock, address):
    request_receiver = RequestReceiver(sock)

    request = ws.http.parser.parse(request_receiver)

    return ws.serve.serve_file(sock, request.request_line.request_target.path)


def main():
    with Server() as server:
        client_socket, address = server.listen()

    # handle_connection must be outside the server context
    # so the parent process' listening socket can be cleaned up
    # noinspection PyBroadException
    try:
        handle_connection(client_socket, address)
    except BaseException:
        error_log.exception(
            'Failed to handle connection of socket %s',
            client_socket
        )
    finally:
        error_log.debug('Closing client socket. %s', client_socket)
        # TODO shutdown ?
        client_socket.close()


if __name__ == '__main__':
    main()
