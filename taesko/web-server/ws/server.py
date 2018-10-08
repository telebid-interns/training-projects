import collections
import enum
import errno
import logging
import os
import signal
import socket
import time

import ws.http.parser
import ws.http.structs
import ws.responses
import ws.serve
import ws.sockets
from ws.config import config
from ws.err import *
from ws.logs import error_log, access_log


class Server:
    class ExecutionContext(enum.Enum):
        main = 'main'
        worker = 'worker'

    ActiveWorker = collections.namedtuple('ActiveWorker', ['pid', 'created_on'])

    def __init__(self):
        assert_system(self.sys_has_fork_support(),
                      msg="Kernel or C lib versions don't have fork() support.",
                      code='FORK_NOT_IMPLEMENTED')

        self.host = config['settings']['host']
        self.port = config.getint('settings', 'port')
        self.process_timeout = config.getint('settings', 'process_timeout')
        self.concurrency = config.getint('settings', 'max_concurrent_requests')
        self.process_count_limit = config.getint('settings',
                                                 'process_count_limit')
        self.execution_context = self.ExecutionContext.main

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
        # don't cleanup workers because their sockets were already closed
        # during the self.fork() call
        if self.execution_context == self.ExecutionContext.worker:
            return False

        if exc_type:
            error_log.exception('Unhandled error while listening.'
                                'Shutting down...')

        error_log.info("Closing server's listening socket")
        self.sock.close()

        if self.workers:
            error_log.info('%d child process found. Waiting completion',
                           len(self.workers))

            active_workers = collections.deque()

            for worker in self.workers:
                has_finished, exit_code = os.waitpid(worker.pid, os.WNOHANG)

                if not has_finished:
                    error_log.info('Terminating worker %d', worker.pid)
                    os.kill(signal.SIGTERM, worker.pid)
                else:
                    error_log.info('Reaped worker %d.', worker.pid)
                    active_workers.append(worker)

            self.workers = active_workers

        return False

    def listen(self):
        error_log.info('Listening...')
        self.sock.listen(self.concurrency)

        while True:
            try:
                client_socket, address = self.sock.accept()
                client_socket = ws.sockets.ClientSocket(
                    client_socket,
                    socket_timeout=config.getint('http', 'request_timeout'),
                    connection_timeout=config.getint('http',
                                                     'connection_timeout')
                )
            except OSError as err:
                error_log.warning('accept() raised ERRNO=%s', err.errno)

                # TODO perhaps reopen failed listening sockets.
                assert err.errno not in (errno.EBADF, errno.EFAULT,
                                         errno.EINVAL, errno.ENOTSOCK,
                                         errno.EOPNOTSUPP)

                if err.errno == errno.EPERM:
                    error_log.info('Denied client connection, because firewall '
                                   'blocked the accept() call.')
                elif err.errno in (errno.EPROTO, errno.ECONNABORTED):
                    error_log.info('Protocol or connection error from client.')
                elif err.errno in (errno.EMFILE, errno.ENFILE,
                                   errno.ENOBUFS, errno.ENOMEM):
                    error_log.error('Socket memory or file descriptors run '
                                    'out. Server will continue listening. '
                                    'But connections will be refused until '
                                    'resources are free.')

                # don't break the listening loop just because one accept failed
                continue

            error_log.debug('Accepted connection. '
                            'client_socket.fileno=%d and address=%s',
                            client_socket.fileno(), address)
            error_log.info('Pre-parsing request to verify syntax of headers.')

            if not pre_verify_request_syntax(client_socket, address):
                client_socket.shutdown(ws.sockets.SHUT_RDWR)
                client_socket.close()
                continue

            try:
                forked_pid = self.fork(client_socket)
            except SysError as err:
                if err.code == 'FORK_PROCESS_COUNT_LIMIT_REACH':
                    error_log.warning('Process count limit has been reached '
                                      'and server cannot fork itself any more '
                                      '503 will be the status code of all '
                                      'requests until resources are freed.')
                else:
                    error_log.exception('Forking failed.')
                # noinspection PyBroadException
                try:
                    response = ws.responses.service_unavailable
                    # TODO reject invalid requests from the same client if it
                    # happens multiple times
                    self.work(client_socket, address,
                              quick_reply_with=response)
                except BaseException:
                    logging.exception('Unhandled exception occurred while '
                                      'responding to client from the main'
                                      'process. Catching and continuing'
                                      'to listen.')
                continue

            if forked_pid == 0:
                status = 0
                # noinspection PyBroadException
                try:
                    self.work(client_socket, address)
                except Exception:
                    status = 1
                    logging.exception('Unhandled exception occurred while'
                                      ' Exiting with status code %s', status)
                # noinspection PyProtectedMember
                os._exit(status)
            else:
                pass

    def fork(self, client_socket):
        """ Forks the process and sets the self.execution_context field.

        Also closes the listening socket in the child process and
        the client socket in the parent process.

        Raises the following exceptions:
            SysError with codes FORK_NOT_ENOUGH_RESOURCES or FORK_UNKNOWN_ERROR
                if this exception is raised the process isn't forked and
                no sockets are closed.
        """
        assert self.execution_context == self.ExecutionContext.main
        assert isinstance(client_socket, ws.sockets.ClientSocket)

        if len(self.workers) >= self.process_count_limit:
            raise SysError(msg='Cannot fork because process limit has been '
                               'reached.',
                           code='FORK_PROCESS_COUNT_LIMIT_REACHED')

        try:
            pid = os.fork()
        except OSError as err:
            error_log.warning('fork() raised ERRNO=%d. Reason: %s',
                              err.errno, err.strerror)

            # TODO are these SysErrors ? or should the OSError be reraised
            # instead of transformed ?
            if err.errno in (errno.ENOMEM, errno.EAGAIN):
                error_log.warning('Not enough resources to serve the '
                                  'client connection. Server will continue '
                                  'listening but connections will receive '
                                  '503 until resources are free.')
                raise SysError(msg='Not enough resources to serve client '
                                   'request through fork.',
                               code='FORK_NOT_ENOUGH_RESOURCES') from err

            raise SysError(msg='Unhandled ERRNO={0.d} raised from fork().'
                               'Exception reason: {1}'.format(err.errno,
                                                              err.strerror),
                           code='FORK_UNKNOWN_ERROR') from err

        if pid == 0:
            self.execution_context = self.ExecutionContext.worker
            error_log.debug('Closing listening socket in child.')
            self.sock.close()
        else:
            error_log.info('Spawned child process with pid %d', pid)
            error_log.debug('Closing client socket in parent process')

            try:
                client_socket.close()
            except OSError:
                error_log.exception('Failed to clean up client socket in '
                                    'parent process.')
            self.workers.append(self.ActiveWorker(pid=pid,
                                                  created_on=time.time()))

        return pid

    @staticmethod
    def work(client_socket, address, quick_reply_with=None):
        with Worker(client_socket, address) as worker:
            if quick_reply_with:
                worker.respond(quick_reply_with, closing=True,
                               ignored_request=True)
                return

            while worker.http_connection_is_open:
                # TODO client's connection might drop while recv()
                # no need to send him a response
                request = worker.parse_request()
                response = handle_request(request)
                worker.respond(response)

    @staticmethod
    def sys_has_fork_support():
        error_log.info('Checking if system has fork support by doing a '
                       'dummy fork...')
        try:
            pid = os.fork()
        except OSError as err:
            if err.errno == errno.ENOSYS:
                error_log.critical('System does not have fork() support.')
                return False
            else:
                return True

        if pid == 0:
            # noinspection PyProtectedMember
            os._exit(0)
        else:
            error_log.info('Fork successful. Cleaning up dummy child '
                           '(pid={:d})...'.format(pid))
            os.waitpid(pid, 0)

        return True

    # noinspection PyUnusedLocal
    def terminate_hanged_workers(self, signum, stack_frame):
        assert signum == signal.SIGALRM

        error_log.debug('Caught SIGALRM signal to join and terminate workers')

        leftover_workers = collections.deque()

        for worker in self.workers:
            try:
                has_finished, status = os.waitpid(worker.pid, os.WNOHANG)
            except OSError as err:
                error_log.exception('Could not reap child worker with pid %d.'
                                    'waitpid() returned ERRNO=%d and reason=%s',
                                    worker.pid, err.errno, err.strerror)
                # don't stop the listening loop and continue reaping the rest
                # of the workers.
                continue

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
                try:
                    os.kill(worker.pid, signal.SIGTERM)
                    error_log.info('Sent SIGTERM to hanged worker with pid=%d',
                                   worker.pid)
                except OSError:
                    error_log.exception('Failed to sent SIGTERM to '
                                        'hanged worker with pid=%d', worker.pid)

        error_log.debug('Rescheduling SIGALRM signal to after %s seconds',
                        self.process_timeout)
        signal.alarm(self.process_timeout)


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
        def client_closed_connection(request):
            if not request:
                return False
            elif 'Connection' not in request.headers:
                return False
            else:
                pass

            c = request.headers['Connection']
            hop_by_hop_headers = (h.strip() for h in c.split(b','))

            return b'close' in hop_by_hop_headers

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

        return not (client_closed_connection(request=self.last_request) or
                    server_closed_connection(response=self.last_response))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not exc_val:
            error_log.info('Cleaning up worker after successful execution.')
            self.sock.shutdown(socket.SHUT_RDWR)
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
            self.sock.shutdown(socket.SHUT_RDWR)
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
        ignored_request = False

        if hasattr(exc_val, 'code'):
            ignored_request = exc_val.code in (
                'CS_CONNECTION_TIMED_OUT',
                'CS_PEER_SEND_IS_TOO_SLOW',
                'CS_PEER_NOT_SENDING'
            )

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
            self.sock.shutdown(socket.SHUT_WR)
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


def pre_verify_request_syntax(client_socket, address):
    """ Checks if the syntax of the incoming request from the socket is ok.

    If the syntax is malformed an adequate response is sent to the client.

    It's possible for this function to raise:
        SystemExit
        KeyboardInterrupt
    """
    # noinspection PyBroadException
    try:
        ws.http.parser.parse(client_socket, lazy=True)
    except ws.http.parser.ParserError as err:
        error_log.warning('During pre-parsing: failed to parse request from '
                          'client socket %s. Error code=%s',
                          client_socket.fileno(), err.code)

        try:
            client_socket.send_all(bytes(ws.responses.bad_request))
            access_log.log(request=None, response=ws.responses.bad_request)
        except ws.sockets.ClientSocketError:
            error_log.warning('Client socket %s did not receive response.')

        return False
    except ws.sockets.ClientSocketError as err:
        error_log.warning('During pre-parsing: client socket %s caused an '
                          'error with code %s ',
                          client_socket.fileno(), err.code)
        return False
    except Exception:
        error_log.exception('During pre-parsing: parser failed on socket %s ',
                            client_socket.fileno())
    finally:
        # reset the client socket so later handling of the request does not have
        # to do it manually.
        client_socket.reiterate()

    return True


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


def main():
    # Main process should never exit from the server.listen() loop unless
    # an exception occurs.
    with Server() as server:
        server.listen()


if __name__ == '__main__':
    main()
