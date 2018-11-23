import os
import socket
import select
import traceback
import errno
from http_meta import RequestMeta
from log import log, TRACE, DEBUG, INFO
from config import CONFIG
from client_connection import ClientConnection
from web_server_utils import resolve_static_file_path


class Worker:
    def __init__(self):
        log.error(TRACE)

        self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._poll = select.poll()
        self._activity_iterators = {}

    def start(self):
        log.error(TRACE)

        self._socket.bind((CONFIG['host'], CONFIG['port']))
        log.error(TRACE, msg='socket bound: {0}:{1}'.format(CONFIG['host'],
                                                            CONFIG['port']))

        self._socket.listen(CONFIG['backlog'])
        log.error(TRACE,
                  msg='listening... backlog: {0}'.format(CONFIG['backlog']))

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
        log.error(TRACE)

        if isinstance(fd, socket.socket):
            fd = fd.fileno()

        self._poll.register(fd, event)
        self._activity_iterators[fd] = it

    def unregister_activity(self, fd):
        log.error(TRACE)

        self._poll.unregister(fd)
        del self._activity_iterators[fd]

    def req_handler(self, client_conn):
        try:
            log.error(TRACE)

            assert isinstance(client_conn, ClientConnection)

            # may send response to client in case of invalid
            # request
            yield from client_conn.receive_meta()

            if client_conn.state != (
                ClientConnection.State.RECEIVING
            ):
                return

            log.error(TRACE, msg='resolving file_path...')

            assert isinstance(client_conn.req_meta, RequestMeta)
            assert isinstance(client_conn.req_meta.target, str)

            # ignoring query params
            req_target_path = client_conn.req_meta.target.split('?', 1)[0]
            log.error(DEBUG, var_name='req_target_path',
                      var_value=req_target_path)

            file_path = os.path.realpath(req_target_path)

            log.error(DEBUG, var_name='file_path', var_value=file_path)

            log.error(TRACE, msg='requested file in web server document root')

            # TODO make cgi-bin not accessible

            if file_path.startswith(CONFIG['cgi_dir']):
                yield from client_conn.serve_cgi_script(file_path)
            else:
                yield from client_conn.serve_static_file(
                    resolve_static_file_path(file_path)
                )
        except FileNotFoundError as error:
            log.error(TRACE, msg='FileNotFoundError')
            log.error(DEBUG, msg=error)

            if client_conn.state in (
                ClientConnection.State.ESTABLISHED,
                ClientConnection.State.RECEIVING
            ):
                yield from client_conn.send_meta(b'404')
        except IsADirectoryError as error:
            log.error(TRACE, msg='IsADirectoryError')
            log.error(DEBUG, msg=error)

            if client_conn.state in (
                ClientConnection.State.ESTABLISHED,
                ClientConnection.State.RECEIVING
            ):
                yield from client_conn.send_meta(b'404')
        except OSError as error:
            log.error(TRACE, msg='OSError')
            log.error(DEBUG, msg=error)

            if client_conn.state in (
                ClientConnection.State.ESTABLISHED,
                ClientConnection.State.RECEIVING
            ):
                yield from client_conn.send_meta(b'503')
        except AssertionError as error:
            log.error(TRACE, msg='AssertionError')
            log.error(INFO, msg=str(error) + str(traceback.format_exc()))

            if client_conn.state in (
                ClientConnection.State.ESTABLISHED,
                ClientConnection.State.RECEIVING
            ):
                yield from client_conn.send_meta(b'500')
        except Exception as error:
            log.error(TRACE, msg='Exception')
            log.error(INFO, msg=str(error) + str(traceback.format_exc()))

            if client_conn.state in (
                ClientConnection.State.ESTABLISHED,
                ClientConnection.State.RECEIVING
            ):
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
                1,
                remote_addr='{0}:{1}'.format(client_conn.remote_addr,
                                             client_conn.remote_port),
                req_line=req_line,
                user_agent=user_agent,
                status_code=client_conn.res_meta.status_code,
                content_length=client_conn.res_meta.content_length,
            )

    def gen_accept(self):
        log.error(TRACE)

        while True:
            yield (self._socket, select.POLLIN)

            conn, addr = self._socket.accept()
            log.error(TRACE, msg='connection accepted')
            log.error(DEBUG, var_name='conn', var_value=conn)
            log.error(DEBUG, var_name='addr', var_value=addr)

            self.register_activity(
                conn,
                select.POLLIN,
                self.req_handler(ClientConnection(conn, addr))
            )

    def stop(self):
        log.error(TRACE)
        self._socket.close()
