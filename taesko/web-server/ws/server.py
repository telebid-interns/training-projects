import collections
import enum
import errno
import os
import signal
import socket
import time

import ws.http.parser
import ws.responses
import ws.sockets
import ws.worker
from ws.config import config
from ws.err import *
from ws.logs import error_log, access_log


class RequestRateController:
    max_recorded_addresses = 10
    max_recorded_connections = 10
    required_records = 5
    deny_on = 3

    def __init__(self):
        factory = lambda: collections.deque(
            maxlen=self.max_recorded_connections)
        self.clients = collections.defaultdict(factory)

    def can_accept_connection(self, address):
        if len(self.clients[address]) < self.required_records:
            return True

        client_errors = sum(code == ws.worker.ExitCodes.too_many_client_errors
                            for code in self.clients[address])

        return client_errors >= self.deny_on

    def record_handled_connection(self, address, worker_exit_code):
        if len(self.clients) <= self.max_recorded_addresses:
            self.clients[address].append(worker_exit_code)
        else:
            for a in self.clients:
                if a != address:
                    del self.clients[a]
                    self.clients[address].append(worker_exit_code)
                    break


class Server:
    class ExecutionContext(enum.Enum):
        main = 'main'
        worker = 'worker'

    ActiveWorker = collections.namedtuple('ActiveWorker', ['pid', 'created_on',
                                                           'client_address'])

    def __init__(self):
        assert_system(sys_has_fork_support(),
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
        self.rate_controller = RequestRateController()

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

    def listen(self, client_socket_handler):
        assert isinstance(client_socket_handler, collections.Callable)

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

            if self.rate_controller.can_accept_connection(address):
                error_log.info('Accepted connection. '
                               'client_socket.fileno=%d and address=%s',
                               client_socket.fileno(), address)
            else:
                error_log.warning('Denied connection. '
                                  'client_socket.fileno=%d and address=%s')
                client_socket.close(pass_silently=True)
                continue

            try:
                forked_pid = self.fork(client_socket, address)
            except SysError as err:
                if err.code == 'FORK_PROCESS_COUNT_LIMIT_REACH':
                    error_log.warning('Process count limit has been reached '
                                      'and server cannot fork itself any more '
                                      '503 will be the exit_code code of all '
                                      'requests until resources are freed.')
                else:
                    error_log.exception('Forking failed.')
                # noinspection PyBroadException
                try:
                    response = ws.responses.service_unavailable
                    # TODO reject invalid requests from the same client if it
                    # happens multiple times
                    client_socket_handler(client_socket, address,
                                          quick_reply_with=response)
                except Exception:
                    error_log.exception('Unhandled exception occurred while '
                                        'responding to client from the main'
                                        'process. Catching and continuing'
                                        'to listen.')
                continue

            if forked_pid == 0:
                exit_code = 1
                # noinspection PyBroadException
                try:
                    exit_code = client_socket_handler(client_socket, address)
                except Exception:
                    exit_code = 1
                    error_log.exception('Got error from client_socket_handler '
                                        'in worker.')
                error_log.info('Exiting with exit code %s', exit_code)
                # noinspection PyProtectedMember
                os._exit(exit_code.value)
            else:
                pass

    def fork(self, client_socket, address):
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
                                                  created_on=time.time(),
                                                  client_address=address))

        return pid

    # noinspection PyUnusedLocal
    def terminate_hanged_workers(self, signum, stack_frame):
        assert signum == signal.SIGALRM

        error_log.debug('Caught SIGALRM signal to join and terminate workers')

        leftover_workers = collections.deque()

        for worker in self.workers:
            try:
                has_finished, exit_code = os.waitpid(worker.pid, os.WNOHANG)
            except OSError as err:
                error_log.exception('Could not reap child worker with pid %d.'
                                    'waitpid() returned ERRNO=%d and reason=%s',
                                    worker.pid, err.errno, err.strerror)
                # don't stop the listening loop and continue reaping the rest
                # of the workers.
                continue

            if has_finished:
                error_log.info('Worker %s has finished.', worker)
                self.rate_controller.record_handled_connection(
                    address=worker.client_address,
                    worker_exit_code=exit_code
                )
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


def main():
    # Main process should never exit from the server.listen() loop unless
    # an exception occurs.
    with Server() as server:
        server.listen(ws.worker.work)


if __name__ == '__main__':
    main()
