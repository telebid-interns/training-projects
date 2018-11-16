import traceback
import errno
import json
import os
import socket
import signal
from config import CONFIG
from log import log, TRACE, DEBUG, INFO
from client_connection import ClientConnection
from web_server_utils import resolve_static_file_path
from http_meta import RequestMeta


class Server:
    def __init__(self):
        log.error(TRACE)
        signal.signal(signal.SIGCHLD, self.reap_child)

        self._conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._conn.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        log.error(TRACE, msg='socket option SO_REUSEADDR set')

    def run(self):
        log.error(TRACE)
        self._conn.bind((CONFIG['host'], CONFIG['port']))
        log.error(TRACE, msg='socket bound: {0}:{1}'.format(CONFIG['host'],
                                                            CONFIG['port']))

        self._conn.listen(CONFIG['backlog'])
        log.error(TRACE,
                  msg='listening... backlog: {0}'.format(CONFIG['backlog']))

        client_conn = None
        pid = None

        while True:
            try:
                client_conn = self.accept()

                pid = os.fork()

                if pid == 0:  # child process
                    process_status = os.EX_OK

                    # SIGCHLD signals should only be handled by parent
                    signal.signal(signal.SIGCHLD, signal.SIG_DFL)

                    self.stop()

                    try:
                        log.init_access_log_file()

                        # may send response to client in case of invalid
                        # request
                        client_conn.receive_meta()

                        if client_conn.state != (
                            ClientConnection.State.RECEIVING
                        ):
                            break

                        log.error(TRACE, msg='resolving file_path...')

                        assert isinstance(client_conn.req_meta, RequestMeta)
                        assert isinstance(client_conn.req_meta.target, str)

                        # ignoring query params
                        req_target_path = client_conn.req_meta.target \
                            .split('?', 1)[0]
                        log.error(DEBUG, var_name='req_target_path',
                                  var_value=req_target_path)

                        file_path = os.path.realpath(req_target_path)

                        log.error(DEBUG, var_name='file_path',
                                  var_value=file_path)

                        log.error(TRACE, msg=('requested file in web server ' +
                                              'document root'))

                        # TODO make cgi-bin not accessible

                        if file_path.startswith(CONFIG['cgi_dir']):
                            client_conn.serve_cgi_script(file_path)
                        else:
                            client_conn.serve_static_file(
                                resolve_static_file_path(file_path)
                            )

                    except FileNotFoundError as error:
                        log.error(TRACE, msg='FileNotFoundError')
                        log.error(DEBUG, msg=error)

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'404')
                    except IsADirectoryError as error:
                        log.error(TRACE, msg='IsADirectoryError')
                        log.error(DEBUG, msg=error)

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'404')
                    except OSError as error:
                        process_status = os.EX_OSERR

                        log.error(TRACE, msg='OSError')
                        log.error(DEBUG, msg=error)

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'503')
                    except AssertionError as error:
                        process_status = os.EX_SOFTWARE

                        log.error(TRACE, msg='AssertionError')
                        log.error(INFO,
                                  msg=str(error) + str(traceback.format_exc()))

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'500')
                    except Exception as error:
                        process_status = os.EX_SOFTWARE

                        log.error(TRACE, msg='Exception')
                        log.error(INFO,
                                  msg=str(error) + str(traceback.format_exc()))

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'500')
                    finally:
                        try:
                            client_conn.shutdown()
                        except OSError as error:
                            if error.errno != errno.ENOTCONN:
                                process_status = os.EX_OSERR
                                raise error
                else:  # parent process
                    log.error(DEBUG, msg='New child created with pid {0}'.format(pid))  # noqa

            except OSError as error:
                log.error(TRACE, msg='OSError')
                log.error(TRACE, msg=error)
            finally:
                if client_conn is not None and (
                   client_conn.state != ClientConnection.State.CLOSED):

                    try:
                        client_conn.close()
                    except Exception as error:
                        log.error(TRACE, msg=error)

                if pid is not None and pid == 0:  # child
                    if client_conn is not None:  # access log
                        if client_conn.req_meta is None:
                            req_line = None
                            user_agent = None
                        else:
                            req_line = client_conn.req_meta.req_line_raw
                            user_agent = client_conn.req_meta.user_agent

                        log.access(
                            1,
                            remote_addr='{0}:{1}'.format(client_conn.remote_addr,  # noqa
                                                         client_conn.remote_port),  # noqa
                            req_line=req_line,
                            user_agent=user_agent,
                            status_code=client_conn.res_meta.status_code,
                            content_length=client_conn.res_meta.content_length,
                        )

                    log.close_access_log_file()
                    os._exit(process_status)

    def accept(self):
        log.error(TRACE, msg='ready to accept connection')

        conn, addr = self._conn.accept()
        log.error(TRACE, msg='connection accepted')
        log.error(DEBUG, var_name='conn', var_value=conn)
        log.error(DEBUG, var_name='addr', var_value=addr)

        return ClientConnection(conn, addr)

    def reap_child(self, signal_number, stack_frame):
        while True:
            try:
                pid, exit_indicators = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:  # when there are no children
                break

            if pid == 0 and exit_indicators == 0:
                # when there are children, but they have not exited
                break

    def stop(self):
        log.error(TRACE)
        self._conn.close()


def start():
    log.error(TRACE)

    server = Server()

    try:
        server.run()
    except OSError as error:
        log.error(TRACE, msg='OSError thrown while initializing web server')
        log.error(INFO, msg=error)
    except AssertionError as error:
        log.error(TRACE, msg='AssertionError thrown')
        log.error(INFO, msg=str(error) + str(traceback.format_exc()))
    except Exception as error:
        log.error(TRACE, msg='Exception thrown')
        log.error(INFO, msg=str(error) + str(traceback.format_exc()))
    finally:
        server.stop()


if __name__ == '__main__':
    try:
        log.error(DEBUG, var_name='config', var_value=CONFIG)

        start()
    except OSError as error:
        log.error(INFO, msg=error)
    except json.JSONDecodeError as error:
        log.error(INFO,
                  msg='error while parsing config file: {0}'.format(error))
