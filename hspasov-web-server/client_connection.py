import enum
import socket
import os
import sys
import traceback
from uid import UID
from config import CONFIG
from log import log, TRACE, DEBUG, INFO
from http_meta import ResponseMeta
from http_msg_formatter import HTTP1_1MsgFormatter
from cgi_handler import CGIHandler, CGIMsgFormatter
from web_server_utils import resolve_web_server_path


class ClientConnection:
    class State(enum.Enum):
        ESTABLISHED = enum.auto()
        RECEIVING = enum.auto()
        SENDING = enum.auto()
        CLOSED = enum.auto()

    def __init__(self, conn, addr):
        log.error(TRACE)

        assert isinstance(conn, socket.socket)
        assert isinstance(addr, tuple)
        assert len(addr) == 2
        assert isinstance(addr[0], str)
        assert isinstance(addr[1], int)

        self._conn = conn
        self.remote_addr = addr[0]
        self.remote_port = addr[1]
        self._conn.settimeout(CONFIG['socket_operation_timeout'])
        self._req_meta_raw = b''
        self._msg_buffer = None
        self.state = ClientConnection.State.ESTABLISHED
        self.req_meta = None
        self.res_meta = ResponseMeta()

    def receive_meta(self):
        log.error(TRACE)

        self.state = ClientConnection.State.RECEIVING

        while len(self._req_meta_raw) <= CONFIG['req_meta_limit']:
            log.error(TRACE, msg='receiving data...')

            try:
                self.receive()
            except socket.timeout:
                log.error(TRACE, msg='timeout while receiving from client')
                self.send_meta(b'408')
                return

            log.error(DEBUG, var_name='_msg_buffer',
                      var_value=self._msg_buffer)

            self._req_meta_raw += self._msg_buffer

            if len(self._msg_buffer) <= 0:
                log.error(TRACE, msg='connection closed by peer')
                return

            if self._req_meta_raw.find(b'\r\n\r\n') != -1:
                log.error(TRACE, msg='reached end of request meta')
                self._msg_buffer = self._req_meta_raw.split(b'\r\n\r\n', 1)[1]
                break
        else:
            log.error(TRACE, msg='request message too long')
            self.send_meta(b'400')
            return

        log.error(TRACE, msg='parsing request message...')

        self.req_meta = HTTP1_1MsgFormatter.parse_req_meta(self._req_meta_raw)

        if self.req_meta is None:
            log.error(TRACE, msg='invalid request')
            self.send_meta(b'400')
            return

        log.error(DEBUG, var_name='request meta',
                  var_value=self.req_meta)

    def receive(self):
        log.error(TRACE)
        self._msg_buffer = self._conn.recv(CONFIG['recv_buffer'])

    def send_meta(self, status_code, headers={}):
        log.error(TRACE)
        log.error(DEBUG, var_name='status_code', var_value=status_code)
        log.error(DEBUG, var_name='headers', var_value=headers)

        assert type(status_code) is bytes
        assert type(headers) is dict

        self.state = ClientConnection.State.SENDING
        self.res_meta.status_code = status_code

        result = HTTP1_1MsgFormatter.build_res_meta(status_code, headers)

        log.error(DEBUG, var_name='result', var_value=result)

        self.send(result)

    def send(self, data):
        log.error(TRACE)

        assert isinstance(data, bytes)

        log.error(DEBUG, var_name='data', var_value=data)

        self._conn.sendall(data)

    def serve_static_file(self, file_path):
        log.error(TRACE)

        os.chroot(CONFIG['web_server_root'])
        os.setreuid(UID, UID)

        with open(file_path, mode='rb') as content_file:
            log.error(TRACE, msg='requested file opened')

            self.res_meta.content_length = os.path.getsize(file_path)

            log.error(DEBUG, var_name='content_length',
                      var_value=self.res_meta.content_length)

            self.res_meta.headers[b'Content-Length'] = bytes(
                str(self.res_meta.content_length),
                'utf-8'
            )
            self.send_meta(b'200', self.res_meta.headers)

            self.res_meta.packages_sent = 1

            while True:
                response = content_file.read(
                    CONFIG['read_buffer'])
                log.error(DEBUG, var_name='response', var_value=response)

                if len(response) <= 0:
                    log.error(TRACE, msg='end of file reached while reading')
                    break

                log.error(TRACE,
                          msg=('sending response.. ' +
                               'response_packages_sent: ' +
                               '{0}'.format(self.res_meta.packages_sent)))

                self.send(response)

    def serve_cgi_script(self, file_path):
        log.error(TRACE)

        cgi_env = CGIMsgFormatter.build_cgi_env(self.req_meta,
                                                self.remote_addr)

        if cgi_env is None:
            self.send_meta(b'400')
            return

        child_read, parent_write = os.pipe()
        parent_read, child_write = os.pipe()

        pid = os.fork()

        if pid == 0:  # child process
            try:
                os.dup2(child_read, sys.stdin.fileno(), inheritable=True)
                os.dup2(child_write, sys.stdout.fileno(), inheritable=True)
                os.close(parent_read)
                os.close(parent_write)

                for key, value in cgi_env.items():
                    assert isinstance(key, str)
                    assert isinstance(value, str)

                os.execve(resolve_web_server_path(file_path),
                          [file_path], cgi_env)
            except OSError as error:
                log.error(INFO, msg=error)
                os._exit(os.EX_OSERR)
            except Exception as error:
                log.error(INFO, msg=(str(error) + str(traceback.format_exc)))
                os._exit(os.EX_SOFTWARE)
            finally:  # this should never run
                err_msg = ('Unexpected condition. exec* function did not ' +
                           'run before finally.'),
                log.error(INFO, msg=(str(err_msg) + str(traceback.format_exc)))
                os._exit(os.EX_SOFTWARE)
        else:  # parent process
            log.error(DEBUG, msg='New child created with pid {0}'.format(pid))

            os.close(child_read)
            os.close(child_write)

            cgi_handler = CGIHandler(parent_read, parent_write)

            if cgi_env['CONTENT_LENGTH'] is not None:
                # sending remaining received from receive_meta bytes, which are
                # not meta, but part of the body
                cgi_handler.send(self._msg_buffer)

                content_length = int(cgi_env['CONTENT_LENGTH'])

                log.error(TRACE, msg='before write to cgi loop')
                log.error(DEBUG, var_name='bytes_written',
                          var_value=cgi_handler.bytes_written)
                log.error(DEBUG, var_name='content_length',
                          var_value=content_length)

                while cgi_handler.bytes_written < content_length:
                    try:
                        self.receive()
                    except socket.timeout:
                        log.error(TRACE,
                                  msg='timeout while receiving from client')
                        self.send_meta(b'408')
                        return

                    log.error(DEBUG, var_name='_msg_buffer',
                              var_value=self._msg_buffer)

                    if len(self._msg_buffer) <= 0:
                        log.error(TRACE, msg='connection closed by peer')
                        return

                    cgi_handler.send(self._msg_buffer)

            self.state = ClientConnection.State.SENDING

            cgi_res_meta_raw = cgi_handler.receive_meta()

            if cgi_res_meta_raw is None:
                self.send_meta(b'502')
                return

            log.error(TRACE, msg='parsing CGI meta...')

            res_headers = CGIMsgFormatter.parse_cgi_res_meta(cgi_res_meta_raw)

            if res_headers is None:
                self.send_meta(b'502')
                return

            if 'Status' in res_headers and res_headers['Status'] in HTTP1_1MsgFormatter.response_reason_phrases.keys():
                self.send_meta(res_headers['Status'], res_headers)  # TODO maybe status code should not be in headers
            else:
                self.send_meta(b'200', res_headers)

            if len(cgi_handler.msg_buffer) > 0:
                self.send(cgi_handler.msg_buffer)

            while True:
                cgi_handler.receive()

                if len(cgi_handler.msg_buffer) <= 0:
                    log.error(TRACE,
                              msg='end of cgi response reached while reading')
                    break

                log.error(TRACE, msg='sending response..')

                self.send(cgi_handler.msg_buffer)

            pid, exit_status = os.wait()
            log.error(DEBUG, msg=('child {0} exited.'.format(pid) +
                                  ' exit_status: {0}'.format(exit_status)))

    def shutdown(self):
        log.error(TRACE)
        self._conn.shutdown(socket.SHUT_RDWR)

    def close(self):
        log.error(TRACE)

        self._conn.close()
        self.state = ClientConnection.State.CLOSED
