import collections
import logging
import os
import signal
import socket
import time

import ws.err_responses
import ws.http.parser
import ws.serve
from ws.config import config
from ws.err import *

error_log = logging.getLogger('error')


class Server:
    ActiveWorker = collections.namedtuple('ActiveWorker', ['pid', 'created_on'])

    def __init__(self):
        self.host = config['settings']['host']
        self.port = config.getint('settings', 'port')
        self.process_timeout = config.getint('settings', 'process_timeout')
        self.concurrency = config.getint('settings', 'max_concurrent_requests')

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.workers = collections.deque()

        signal.signal(signal.SIGALRM, self.terminate_hanged_workers)
        signal.alarm(self.process_timeout)

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

    def listen(self):
        error_log.debug('Listening...')
        self.sock.listen(self.concurrency)

        while True:
            client_socket, address = self.sock.accept()
            error_log.debug('Accepted connection. '
                            'client_socket=%s and address=%s',
                            client_socket, address)
            forked_pid = os.fork()

            if forked_pid == 0:
                error_log.debug('Closing listening socket in child.')
                return client_socket, address
            else:
                error_log.info('Spawned child process with pid %d', forked_pid)
                error_log.debug('Closing client socket in parent process')

                client_socket.close()
                self.workers.append(self.ActiveWorker(pid=forked_pid,
                                                      created_on=time.time()))

    def terminate_hanged_workers(self, signum, stack_frame):
        assert signum == signal.SIGALRM

        error_log.debug('Caught SIGALRM signal to join and terminate workers')

        leftover_workers = collections.deque()

        for worker in list(self.workers):
            # TODO this might raise OSError
            has_finished, status = os.waitpid(worker.pid, os.WNOHANG)

            if has_finished:
                error_log.info('Worker %s has finished.', worker)
            else:
                leftover_workers.append(worker)

        self.workers = leftover_workers
        error_log.info('%d active workers left. Searching for hanged workers.',
                       len(self.workers))

        now = time.time()
        for worker in self.workers:
            if now - worker.created_on > self.process_timeout:
                os.kill(worker.pid, signal.SIGTERM)
                error_log.info('Sent SIGTERM to hanged worker %s', worker)

        error_log.debug('Rescheduling SIGALRM signal to after %s seconds',
                       self.process_timeout)
        signal.alarm(self.process_timeout)


class Worker:
    def __init__(self, sock, address):
        self.sock = sock
        self.responding = False

        signal.signal(signal.SIGTERM, self.handle_termination)
        sock.settimeout(config.getint('http', 'request_timeout'))

        self.request_receiver = RequestReceiver(sock)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # No salvation if bytes have already been sent over the socket
        if not ws.err_responses.can_handle_err(exc_val) or self.responding:
            error_log.debug('Shutting down and closing client socket. %s',
                            self.sock)

            if self.responding:
                error_log.critical(
                    'Worker had sent bytes over the socket.'
                    ' Client will receive an invalid HTTP response.'
                )
            else:
                error_log.critical(
                    'Worker cannot handle error.'
                    " Client won't receive an HTTP response."
                )

            self.sock.shutdown(socket.SHUT_RDWR)
            self.sock.close()
            return False

        response = ws.err_responses.handle_err(exc_val)
        response.headers['Connection'] = 'close'
        self.respond(response)

        error_log.debug('Shutting down and closing client socket. %s',
                        self.sock)
        # TODO the socket needs to be shutdown for reading as well, but
        # only after the client has received this response ?
        self.sock.shutdown(socket.SHUT_WR)
        self.sock.close()

    def parse_request(self):
        return ws.http.parser.parse(self.request_receiver)

    def respond(self, response):
        error_log.debug('Sending back response %s', response)
        self.responding = True
        response.send(self.sock)

    def handle_termination(self, signum, stack_info):
        assert signum == signal.SIGTERM

        error_log.info('Parent process requested termination.'
                       ' Cleaning up as much as possible and'
                       ' and sending a service unavailable response')

        # No salvation if bytes have already been sent over the socket
        assert not self.responding

        response = ws.err_responses.service_unavailable()
        response.headers['Connection'] = 'close'
        response.send(self.sock)

        # TODO what kind of error is this ?
        # raise PeerError(msg='Parent process requested termination.',
        #                 code='PROCESSING_TIMED_OUT')
        raise RuntimeError('Parent process requested termination.')


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

        try:
            chunk = self.sock.recv(self.__class__.buffer_size)
        except socket.timeout as e:
            error_log.exception('Socket timed out while receiving request.')
            raise PeerError(msg='Waited too long for a request',
                            code='RECEIVING_REQUEST_TIMED_OUT') from e

        error_log.debug('Read chunk %s', chunk)

        if chunk == b'':
            error_log.info('Socket %s broke', self.sock)
            self.socket_broke = True
            raise StopIteration()
            # raise ws.err.PeerError(code='BROKEN_SOCKET',
            #                        msg='Client send 0 bytes through socket.')

        self.chunks.append(chunk)
        self.current_chunk = iter(chunk)

        return next(self.current_chunk)

    def recv_until_body_depreciated(self):
        last_four = collections.deque(maxlen=4)
        for b in self:
            last_four.append(b)

            if bytes(last_four) == b'\r\n\r\n':
                error_log.debug('Received request headers.')
                break
        else:
            raise PeerError(msg='HTTP request has no trailing CR-LF-CR-LF',
                            code='REQUEST_HAS_NO_END')


# noinspection PyUnusedLocal
def handle_connection_depreciated(sock, address):
    request_receiver = RequestReceiver(sock)

    request = ws.http.parser.parse(request_receiver)

    return ws.serve.serve_file_depreciated(sock,
                                           request.request_line.request_target.path)


def main():
    # Main process should never exit from the server.listen() loop unless
    # an exception occurs.
    with Server() as server:
        client_socket, address = server.listen()

    # noinspection PyBroadException
    try:
        with Worker(client_socket, address) as worker:
            request = worker.parse_request()
            file_path = request.request_line.request_target.path
            response = ws.serve.get_file(file_path)
            worker.respond(response)
    except BaseException:
        status = 1
        logging.exception("Couldn't respond to client."
                          " Exiting with status code %s", status)
        # noinspection PyProtectedMember
        os._exit(status)


if __name__ == '__main__':
    main()
