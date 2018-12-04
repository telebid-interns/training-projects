import os
import fcntl
import socket
import select
import traceback
import errno
from http_meta import RequestMeta
from log import log, DEBUG, ERROR
from config import CONFIG
from client_connection import ClientConnection
from web_server_utils import resolve_static_file_path


class Worker:
    def __init__(self, socket, accept_lock_fd):
        log.error(DEBUG)

        self._socket = socket
        self._accept_lock_fd = accept_lock_fd
        self._poll = select.poll()
        self._activity_iterators = {}

    def start(self):
        log.error(DEBUG)

        accept_iter = self.gen_accept()

        self.register_activity(self._socket, select.POLLIN, accept_iter)

        next(accept_iter)

        while True:
            action_requests = self._poll.poll()

            for fd, event in action_requests:
                assert fd in self._activity_iterators

                activity_iter = self._activity_iterators[fd]
                result = next(activity_iter, None)

                assert result is None or isinstance(result, tuple)

                self.unregister_activity(fd)

                if isinstance(result, tuple):
                    assert len(result) == 2

                    new_fd, new_event = result
                    self.register_activity(new_fd, new_event,
                                           activity_iter)

    def register_activity(self, fd, event, it):
        log.error(DEBUG)

        if isinstance(fd, socket.socket):
            fd = fd.fileno()

        self._poll.register(fd, event)
        self._activity_iterators[fd] = it

    def unregister_activity(self, fd):
        log.error(DEBUG)

        self._poll.unregister(fd)
        del self._activity_iterators[fd]

    def req_handler(self, client_conn):
        try:
            log.error(DEBUG)

            assert isinstance(client_conn, ClientConnection)

            # may send response to client in case of invalid
            # request
            yield from client_conn.receive_meta()

            if client_conn.state != (
                ClientConnection.State.RECEIVING
            ):
                return

            log.error(DEBUG, msg='resolving file_path...')

            log.error(DEBUG, var_name='req_meta', var_value=client_conn.req_meta)
            log.error(DEBUG, msg=type(client_conn.req_meta))
            assert isinstance(client_conn.req_meta, RequestMeta)
            assert isinstance(client_conn.req_meta.target, str)

            # ignoring query params
            req_target_path = client_conn.req_meta.target.split('?', 1)[0]
            log.error(DEBUG, var_name='req_target_path',
                      var_value=req_target_path)

            file_path = os.path.realpath(req_target_path)

            log.error(DEBUG, var_name='file_path', var_value=file_path)

            log.error(DEBUG, msg='requested file in web server document root')

            # TODO make cgi-bin not accessible

            if file_path.startswith(CONFIG['cgi_dir']):
                yield from client_conn.serve_cgi_script(file_path)
            else:
                yield from client_conn.serve_static_file(
                    resolve_static_file_path(file_path)
                )
        except OSError as error:
            log.error(DEBUG, msg=error)
            yield from client_conn.send_meta(b'503')
        except Exception as error:
            log.error(ERROR, msg=str(error) + str(traceback.format_exc()))
            yield from client_conn.send_meta(b'500')
        finally:
            try:
                client_conn.shutdown()
                client_conn.close()
            except OSError as error:
                if error.errno != errno.ENOTCONN:
                    raise error

            if client_conn.req_meta is None:
                req_line = None
                user_agent = None
            else:
                req_line = client_conn.req_meta.req_line_raw
                user_agent = client_conn.req_meta.user_agent

            log.access(
                remote_addr='{0}:{1}'.format(client_conn.remote_addr,
                                             client_conn.remote_port),
                req_line=req_line,
                user_agent=user_agent,
                status_code=client_conn.res_meta.status_code,
                content_length=client_conn.res_meta.headers.get(b'Content-Length'),
            )

    def gen_accept(self):
        log.error(DEBUG)

        while True:
            try:
                fcntl.lockf(self._accept_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)

                yield (self._socket, select.POLLIN)

                conn, addr = self._socket.accept()
                log.error(DEBUG, msg='connection accepted')
                log.error(DEBUG, var_name='conn', var_value=conn)
                log.error(DEBUG, var_name='addr', var_value=addr)

                fcntl.lockf(self._accept_lock_fd, fcntl.LOCK_UN)

                self.register_activity(
                    conn,
                    select.POLLIN,
                    self.req_handler(ClientConnection(conn, addr))
                )
            except OSError:
                # There is a performance problem with this implementation:
                # let's say that worker 1 locks,
                # then a client wants to connect,
                # then worker 1 doesnt accept the connection quickly enough.
                # In this case the rest of the workers
                # will loop until worker 1 accepts the connection.
                # Though, that would not prevent them from serving
                # any requests they have to serve, thanks to yield
                yield (self._socket, select.POLLIN)

    def stop(self):
        log.error(DEBUG)
        self._socket.close()
        self._accept_lock_fd.close()
