import os
import socket
import logging
import collections


from ws.err import *
import ws.config
import ws.serve
from ws.http.parser import HTTPParser

ws.config.configure_logging()


host = 'localhost'
port = 5678


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


def handle_connection(sock, address):
    request_receiver = RequestReceiver(sock)
    request_receiver.recv_until_body()

    return ws.serve.serve_file(sock, '/static/greeting.html')


def listen(sock):
    sock.listen(5)
    error_log.debug('Started server on %s:%s', host, port)

    while True:
        error_log.debug('Listening...')
        client_socket, address = sock.accept()
        error_log.debug('Accepted connection. client_socket=%s and address=%s',
                        client_socket, address)
        child_pid = os.fork()

        if child_pid == 0:
            error_log.debug('Closing listening socket')
            sock.close()
            # noinspection PyBroadException
            try:
                handle_connection(client_socket, address)
            except BaseException:
                error_log.exception('Failed to handle connection of socket %s',
                                    client_socket)
            finally:
                error_log.debug('Closing client socket. %s', client_socket)
                client_socket.close()
            break
        else:
            error_log.info('Spawned child process with pid %d', child_pid)
            error_log.debug('Closing client socket')
            client_socket.close()

    error_log.info('Exiting...')


def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((host, port))

    # noinspection PyBroadException
    try:
        listen(server)
    except BaseException:
        error_log.exception('Unhandled exception occurred. Shutting down...')
    finally:
        error_log.info('Cleaning up listening socket')
        server.close()


if __name__ == '__main__':
    main()
