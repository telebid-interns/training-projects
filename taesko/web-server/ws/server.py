import cProfile
import collections
import enum
import errno
import functools
import io
import os
import pstats
import signal
import socket
import time

import ws.http.parser
import ws.http.utils
import ws.responses
import ws.sockets
import ws.utils
import ws.worker
from ws.config import config
from ws.err import *
from ws.logs import error_log, access_log
from ws.ratelimit import RequestRateController

SERVER_PROFILER = cProfile.Profile()


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
        self.process_reaping_period = config.getint('settings',
                                                    'process_reaping_period')
        self.tcp_backlog_size = config.getint('settings', 'tcp_backlog_size')
        self.process_count_limit = config.getint('settings',
                                                 'process_count_limit')
        self.quick_response_socket_timeout = config.getint(
            'http', 'request_timeout'
        )
        self.quick_response_connection_timeout = config.getint(
            'http', 'connection_timeout'
        )
        self.execution_context = self.ExecutionContext.main

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.workers = {}
        self.rate_controller = RequestRateController()

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

            active_workers = {}

            for worker in self.workers.values():
                has_finished, exit_code = os.waitpid(worker.pid, os.WNOHANG)

                if not has_finished:
                    error_log.info('Terminating worker %d', worker.pid)
                    os.kill(signal.SIGTERM, worker.pid)
                else:
                    error_log.info('Reaped worker %d.', worker.pid)
                    active_workers[worker.pid] = worker

            self.workers = active_workers

        return False

    def listen(self, client_socket_handler):
        assert isinstance(client_socket_handler, collections.Callable)

        def handler_decorator(handler):
            @functools.wraps(handler)
            def wrapped(*args, **kwargs):
                # noinspection PyBroadException
                try:
                    return handler(*args, **kwargs)
                except Exception:
                    error_log.exception('Client socket handler failed.')

                return None

            return wrapped

        client_socket_handler = handler_decorator(client_socket_handler)

        error_log.info('Listening...')
        self.sock.listen(self.tcp_backlog_size)

        while True:
            # TODO this leaves some orphaned children if no requests are coming.
            # this can probably be mitigated through non-blocking sockets
            for _ in range(len(self.workers)):
                self.reap_one_child_safely()

            try:
                client_socket, address = self.sock.accept()
            except OSError as err:
                error_log.warning('accept() raised ERRNO=%s with MSG=%s',
                                  err.errno, err.strerror)

                # TODO perhaps reopen failed listening sockets.
                assert err.errno not in (errno.EBADF, errno.EFAULT,
                                         errno.EINVAL, errno.ENOTSOCK,
                                         errno.EOPNOTSUPP)
                # don't break the listening loop just because one accept failed
                continue

            client_socket = ws.sockets.ClientSocket(
                client_socket,
                socket_timeout=self.quick_response_socket_timeout,
                connection_timeout=self.quick_response_connection_timeout
            )

            if self.rate_controller.is_banned(address[0]):
                error_log.warning('Denied connection. '
                                  'client_socket.fileno=%d and address=%s',
                                  client_socket.fileno(), address)
                client_socket.close(pass_silently=True)
                continue

            error_log.info('Accepted connection. '
                           'client_socket.fileno=%d and address=%s',
                           client_socket.fileno(), address)

            # noinspection PyBroadException
            try:
                forked_pid = self.fork(client_socket, address)
            except (SysError, UserError):
                response = ws.responses.service_unavailable
                client_socket_handler(client_socket, address,
                                      quick_reply_with=response)
                continue
            except Exception:
                error_log.exception('Forking failed for an unknown reason.')
                continue

            if forked_pid == 0:
                exit_code = client_socket_handler(client_socket, address)

                if exit_code is None:
                    exit_code = 2

                error_log.info('Exiting with exit code %s', exit_code)
                # noinspection PyProtectedMember
                os._exit(exit_code)
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
            error_log.warning('Process limit reached. Incoming requests will '
                              'receive a 503.')
            raise UserError(msg='Cannot fork because process limit has been '
                                'reached.',
                            code='FORK_PROCESS_COUNT_LIMIT_REACHED')

        try:
            pid = os.fork()
        except OSError as err:
            error_log.warning('fork() raised ERRNO=%d. Reason: %s',
                              err.errno, err.strerror)
            raise SysError(msg='Fork sys call failed with ERRNO={}'
                           .format(err.errno),
                           code='FORK_FAILED')

        if pid == 0:
            self.execution_context = self.ExecutionContext.worker
            self.sock.close()
        else:
            error_log.info('Spawned child process with pid %d', pid)
            client_socket.close(pass_silently=True, safely=False,
                                with_shutdown=False)
            self.workers[pid] = self.ActiveWorker(pid=pid,
                                                  created_on=time.time(),
                                                  client_address=address)

        return pid

    def reap_one_child_safely(self):
        """ Reap a single zombie child without blocking or raising exceptions.

        This method is NOT thread-safe.
        """
        try:
            pid, exit_indicator, resource_usage = os.wait3(os.WNOHANG)
        except OSError as err:
            error_log.warning('During reaping of zombie child: wait() sys call '
                              'failed with ERRNO=%s and MSG=%s',
                              err.errno, err.strerror)
            return

        if not pid:
            return
        elif pid not in self.workers:
            error_log.warning('Reaped zombie child with pid %s but the pid '
                              'was not recorded as a worker.')
            return

        worker = self.workers[pid]
        del self.workers[pid]

        if not os.WIFEXITED(exit_indicator):
            error_log.warning('Worker %s has finished without calling '
                              'exit(). Server cannot properly decide '
                              'on rate limiting for the client '
                              'serviced by worker.')
        else:
            error_log.info('Worker %s has finished', worker)
            self.rate_controller.record_handled_connection(
                ip_address=worker.client_address[0],
                worker_exit_code=os.WEXITSTATUS(exit_indicator)
            )

    # noinspection PyUnusedLocal
    @ws.utils.depreciated(error_log)
    def terminate_hanged_workers_depreciated(self, signum, stack_frame):
        assert signum == signal.SIGALRM

        error_log.debug('Caught SIGALRM signal to join and terminate workers')

        leftover_workers = collections.deque()

        for worker in self.workers:
            try:
                has_finished, exit_indicator = os.waitpid(worker.pid,
                                                          os.WNOHANG)
            except OSError as err:
                error_log.exception('Could not reap child worker with pid %d.'
                                    'waitpid() returned ERRNO=%d and reason=%s',
                                    worker.pid, err.errno, err.strerror)
                # don't stop the listening loop and continue reaping the rest
                # of the workers.
                continue

            if has_finished:
                if not os.WIFEXITED(exit_indicator):
                    error_log.warning('Worker %s has finished without calling '
                                      'exit(). Server cannot properly decide '
                                      'on rate limiting for the client '
                                      'serviced by worker.')
                else:
                    error_log.info('Worker %s has finished', worker)
                    self.rate_controller.record_handled_connection(
                        ip_address=worker.client_address[0],
                        worker_exit_code=os.WEXITSTATUS(exit_indicator)
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
                        self.process_reaping_period)
        signal.alarm(self.process_reaping_period)


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
        except ws.sockets.ClientSocketException:
            error_log.warning('Client socket %s did not receive response.')

        return False
    except ws.sockets.ClientSocketException as err:
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
    profiling = config.getboolean('settings', 'profile')
    if profiling:
        SERVER_PROFILER.enable()

    try:
        with Server() as server:
            server.listen(ws.worker.work)
    finally:
        if profiling:
            SERVER_PROFILER.disable()
            s = io.StringIO()
            ps = pstats.Stats(SERVER_PROFILER, stream=s)
            ps = ps.sort_stats('cumulative')
            print('PROFILING')
            print('-' * 80)
            ps.print_stats()
            print('PRINTING STREAM')
            print(s.getvalue())
            print('-' * 80)
