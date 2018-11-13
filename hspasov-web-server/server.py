import inspect
import traceback
import errno
import enum
from collections import namedtuple
from datetime import datetime
import json
import pwd
import sys
import os
import socket
import signal
import urllib.parse


class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg


class UserError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


RequestMeta = namedtuple('RequestMeta', [
    'req_line_raw',
    'method',
    'target',
    'query_string',
    'http_version',
    'headers',
    'user_agent',
])


class ResponseMeta:
    def __init__(self):
        self.packages_sent = 0
        self.headers = {}
        self.status_code = None
        self.content_length = None


# class CGIFormatter:
#    @staticmethod
#    def


class HTTP1_1MsgFormatter:
    response_reason_phrases = {
        b'200': b'OK',
        b'400': b'Bad Request',
        b'404': b'Not Found',
        b'408': b'Request Timeout',
        b'500': b'Internal Server Error',
        b'502': b'Bad Gateway',
        b'503': b'Service Unavailable',
    }

    @staticmethod
    def parse_req_meta(msg):
        log.error(TRACE)

        assert type(msg) is bytes

        msg_parts = msg.split(b'\r\n\r\n', 1)
        log.error(DEBUG, var_name='msg_parts', var_value=msg_parts)

        if len(msg_parts) != 2:
            return None

        request_line_and_headers = msg_parts[0].split(b'\r\n')
        log.error(DEBUG, var_name='request_line_and_headers',
                  var_value=request_line_and_headers)

        request_line = request_line_and_headers[0]
        log.error(DEBUG, var_name='request_line',
                  var_value=request_line)

        req_line_tokens = request_line.split(b' ')
        log.error(DEBUG, var_name='req_line_tokens',
                  var_value=req_line_tokens)

        if len(req_line_tokens) != 3:
            return None

        method = req_line_tokens[0]

        if method not in (b'GET', b'HEAD', b'POST', b'PUT', b'DELETE',
                          b'CONNECT', b'OPTIONS', b'TRACE'):
            return None

        target = urllib.parse.unquote(req_line_tokens[1].decode())

        if '?' in target:
            target_query_part = target.split('?', 1)[1]

            if len(target_query_part) > 0:
                query_string = target_query_part
            else:
                query_string = None
        else:
            query_string = None

        headers = {}

        log.error(DEBUG, var_name='headers not parsed',
                  var_value=request_line_and_headers[1:])

        for header_field in request_line_and_headers[1:]:
            header_field_split = header_field.split(b':', 1)

            if len(header_field_split[0]) != len(
                header_field_split[0].strip()
            ):
                return None

            field_name = header_field_split[0]
            field_value = header_field_split[1].strip()
            headers[field_name] = field_value

        log.error(DEBUG, var_name='headers', var_value=headers)

        body = msg_parts[1]
        log.error(DEBUG, var_name='body', var_value=body)

        user_agent = headers['User-Agent'] if 'User-Agent' in headers else None

        result = RequestMeta(
            req_line_raw=request_line.decode(),
            method=method,
            target=target,
            query_string=query_string,
            http_version=req_line_tokens[2],
            headers=headers,
            user_agent=user_agent,
        )
        log.error(DEBUG, var_name='result', var_value=result)

        return result

    @staticmethod
    def build_res_meta(status_code, headers={}, body=b''):
        log.error(TRACE)
        log.error(DEBUG, var_name='status_code', var_value=status_code)
        log.error(DEBUG, var_name='headers', var_value=headers)
        log.error(DEBUG, var_name='body', var_value=body)

        assert type(status_code) is bytes
        assert type(headers) is dict
        assert type(body) is bytes
        assert status_code in HTTP1_1MsgFormatter.response_reason_phrases

        result = (b'HTTP/1.1 ' + status_code + b' ' +
                  HTTP1_1MsgFormatter.response_reason_phrases[status_code])

        for field_name, field_value in headers.items():
            result += (b'\r\n' + field_name + b': ' + field_value)

        result += (b'\r\n\r\n' + body)

        log.error(DEBUG, var_name='result', var_value=result)

        return result


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
        self._cgi_res_meta_raw = b''
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

        try:
            self._conn.sendall(result)
        except Exception as error:
            log.error(DEBUG, msg='GOT IT!')
            log.error(DEBUG, msg=error)
            raise error

    def send(self, data):
        log.error(TRACE)

        assert isinstance(data, bytes)

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

        if b'Content-Length' in self.req_meta.headers:
            assert isinstance(self.req_meta.headers[b'Content-Length'], bytes)

            content_length_str = self.req_meta.headers[b'Content-Length'].decode()
        else:
            log.error(TRACE, msg='No content length provided')
            self.send_meta(b'400')
            return

        assert isinstance(self.req_meta.method, bytes)
        assert (isinstance(self.req_meta.query_string, str) or
                self.req_meta.query_string is None)
        assert isinstance(self.remote_addr, str)
        assert isinstance(CONFIG['protocol'], str)

        cgi_env = {
            'GATEWAY_INTERFACE': 'CGI/1.1',
            'CONTENT_LENGTH': content_length_str,
            'QUERY_STRING': self.req_meta.query_string or '',
            'REMOTE_ADDR': self.remote_addr,
            'REQUEST_METHOD': self.req_meta.method.decode(),
            'SERVER_PORT': str(CONFIG['port']),
            'SERVER_PROTOCOL': CONFIG['protocol'],
        }

        log.error(DEBUG, var_name='cgi_env', var_value=cgi_env)

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

                os.execve(resolve_web_server_path(file_path), [file_path], cgi_env)
            except OSError as error:
                log.error(INFO, msg=error)
                os._exit(os.EX_OSERR)
            except Exception as error:
                handle_error(error, traceback.format_exc())
                os._exit(os.EX_SOFTWARE)
            finally:  # this should never run
                handle_error('Unexpected condition. exec* function did not run before finally.', traceback.format_exc())
                os._exit(os.EX_SOFTWARE)
        else:  # parent process
            log.error(DEBUG, msg='New child created with pid {0}'.format(pid))

            os.close(child_read)
            os.close(child_write)

            if content_length_str is not None:
                # sending remaining received from receive_meta bytes, which are
                # not meta, but part of the body
                bytes_written = len(self._msg_buffer)
                # TODO handle when not all bytes written
                os.write(parent_write, self._msg_buffer)

                content_length = int(content_length_str)

                log.error(TRACE, msg='before write to cgi loop')
                log.error(DEBUG, var_name='bytes_written', var_value=bytes_written)
                log.error(DEBUG, var_name='content_length', var_value=content_length)

                while bytes_written < content_length:
                    try:
                        self.receive()
                    except socket.timeout:
                        log.error(TRACE, msg='timeout while receiving from client')
                        self.send_meta(b'408')
                        return

                    log.error(DEBUG, var_name='_msg_buffer',
                              var_value=self._msg_buffer)

                    bytes_written += len(self._msg_buffer)
                    os.write(parent_write, self._msg_buffer)

                    if len(self._msg_buffer) <= 0:
                        log.error(TRACE, msg='connection closed by peer')
                        return

            self.state = ClientConnection.State.SENDING

            while len(self._cgi_res_meta_raw) <= CONFIG['cgi_res_meta_limit']:
                log.error(TRACE, msg='collecting meta data from cgi..')

                # TODO add new config option, do not use read_buffer
                data = os.read(parent_read, CONFIG['read_buffer'])
                self._cgi_res_meta_raw += data

                log.error(DEBUG, var_name='cgi_res_meta_raw', var_value=self._cgi_res_meta_raw)

                if len(data) <= 0:
                    log.error(TRACE, msg='No data to read.')
                    break

                if self._cgi_res_meta_raw.find(b'\n\n') != -1:
                    log.error(TRACE, msg='finished collecting meta data from cgi')
                    self._msg_buffer = self._cgi_res_meta_raw.split(b'\n\n', 1)[1]
                    break
            else:
                log.error(TRACE, msg='cgi response meta too long')
                self.send_meta(b'502')
                return

            log.error(TRACE, msg='parsing CGI meta...')

            headers_raw = self._cgi_res_meta_raw.split(b'\n\n', 1)[0]
            header_lines = headers_raw.split(b'\n')

            res_headers = {}

            for header_line in header_lines:
                header_split = header_line.split(b':', 1)

                if len(header_split) != 2:
                    self.send_meta(b'502')
                    return

                header_name, header_value = header_split

                res_headers[header_name] = header_value.strip()

            if 'Status' in res_headers and res_headers['Status'] in HTTP1_1MsgFormatter.response_reason_phrases.keys():
                self.send_meta(res_headers['Status'], res_headers)  # TODO maybe status code should not be in headers
            else:
                self.send_meta(b'200', res_headers)

            if len(self._msg_buffer) > 0:
                self.send(self._msg_buffer)

            while True:
                # TODO add new config option, do not use read_buffer
                self._msg_buffer = os.read(parent_read, CONFIG['read_buffer'])

                if len(self._msg_buffer) <= 0:
                    log.error(TRACE, msg='end of cgi response reached while reading')
                    break

                log.error(TRACE, msg='sending response..')

                self.send(self._msg_buffer)

            pid, exit_status = os.wait()
            print('child {0} exited. exit_status: {1}'.format(pid, exit_status))

    def shutdown(self):
        log.error(TRACE)
        self._conn.shutdown(socket.SHUT_RDWR)

    def close(self):
        log.error(TRACE)

        self._conn.close()
        self.state = ClientConnection.State.CLOSED


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
                        handle_error(error, traceback.format_exc())

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'500')
                    except Exception as error:
                        process_status = os.EX_SOFTWARE

                        log.error(TRACE, msg='Exception')
                        handle_error(error, traceback.format_exc())

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
                    log.error(DEBUG, msg='New child created with pid {0}'.format(pid))

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
                            remote_addr='{0}:{1}'.format(client_conn.remote_addr,
                                                         client_conn.remote_port),
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
        log.error(TRACE, msg='reaping children')

        while True:
            try:
                pid, exit_indicators = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError as error:  # when there are no children
                log.error(TRACE, msg='no children to reap')
                log.error(DEBUG, var_name='error', var_value=error)
                break

            if pid == 0 and exit_indicators == 0:
                # when there are children, but they have not exited
                break
            else:
                exit_status = os.WEXITSTATUS(exit_indicators)
                signal_number = os.WTERMSIG(exit_indicators)

                if signal_number == 0:
                    log.error(TRACE, msg='Child pid={0} exit status={1}'.format(pid, exit_status)) # noqa
                else:
                    log.error(TRACE, msg='Child pid={0} killed by signal {1}'.format(pid, signal_number)) # noqa

    def stop(self):
        log.error(TRACE)
        self._conn.close()


def assert_user(condition, msg):
    assert isinstance(condition, bool)

    if not condition:
        raise UserError(msg)


def handle_error(error, traceback):
    log.error(INFO, msg=(str(error) + str(traceback)))


# error log levels
INFO = 1
TRACE = 2
DEBUG = 3


class Log:
    def __init__(self):
        self.access_log_file = None

    def error(self, lvl, *, var_name=None, var_value=None, msg=None):
        if lvl <= CONFIG['error_log_level']:
            fields = []

            if 'pid' in CONFIG['error_log_fields']:
                fields.append(format(os.getpid()))
            if 'timestamp' in CONFIG['error_log_fields']:
                fields.append(format(datetime.now()))
            if 'level' in CONFIG['error_log_fields']:
                fields.append(format(lvl))
            if 'context' in CONFIG['error_log_fields']:
                current_frame = inspect.currentframe()
                caller_frame = inspect.getouterframes(current_frame, 2)
                caller_function = caller_frame[1][3]
                fields.append(format(caller_function))
            if 'var_name' in CONFIG['error_log_fields']:
                fields.append(
                    CONFIG['error_log_empty_field']
                    if var_name is None else format(var_name))
            if 'var_value' in CONFIG['error_log_fields']:
                fields.append(
                    CONFIG['error_log_empty_field']
                    if var_value is None else format(var_value))
            if 'msg' in CONFIG['error_log_fields']:
                fields.append(
                    CONFIG['error_log_empty_field']
                    if msg is None
                    else format(msg))

            print(CONFIG['error_log_field_sep'].join(fields),
                  file=sys.stderr)

    def access(self, lvl, *, remote_addr=None, req_line=None, user_agent=None,
               status_code=None, content_length=None):
        if lvl <= CONFIG['access_log_level']:
            fields = []

            if self.access_log_file is None:
                self.error(INFO, msg=('Attempt to write in uninitialized ' +
                                      'access log file'))
            else:
                if 'pid' in CONFIG['access_log_fields']:
                    fields.append(format(os.getpid()))
                if 'timestamp' in CONFIG['access_log_fields']:
                    fields.append(format(datetime.now()))
                if 'remote_addr' in CONFIG['access_log_fields']:
                    fields.append(
                        CONFIG['access_log_empty_field']
                        if remote_addr is None else format(remote_addr))
                if 'req_line' in CONFIG['access_log_fields']:
                    fields.append(
                        CONFIG['access_log_empty_field']
                        if req_line is None else format(req_line))
                if 'user_agent' in CONFIG['access_log_fields']:
                    fields.append(
                        CONFIG['access_log_empty_field']
                        if user_agent is None else format(user_agent))
                if 'status_code' in CONFIG['access_log_fields']:
                    fields.append(
                        CONFIG['access_log_empty_field']
                        if status_code is None else format(status_code))
                if 'content_length' in CONFIG['access_log_fields']:
                    fields.append(
                        CONFIG['access_log_empty_field']
                        if content_length is None else format(content_length))

                print(CONFIG['access_log_field_sep'].join(fields),
                      file=self.access_log_file)

    def init_access_log_file(self):
        self.access_log_file = open(CONFIG['access_log'], mode='a')

    def close_access_log_file(self):
        self.access_log_file.close()
        self.access_log_file = None


def resolve_web_server_path(path):
    log.error(TRACE)
    log.error(DEBUG, var_name='path', var_value=path)

    resolved_path = os.path.realpath(os.path.join(CONFIG['web_server_root'],
                                     *path.split('/')[1:]))

    log.error(DEBUG, var_name='resolved_path', var_value=resolved_path)

    return resolved_path


def resolve_static_file_path(path):
    log.error(TRACE)
    log.error(DEBUG, var_name='path', var_value=path)

    resolved_path = os.path.realpath(os.path.join(CONFIG['document_root'],
                                                  *path.split('/')[1:]))

    log.error(DEBUG, var_name='resolved_path', var_value=resolved_path)

    return resolved_path


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
        log.error(INFO, msg=error)
        handle_error(error, traceback.format_exc())
    except Exception as error:
        log.error(TRACE, msg='Exception thrown')
        log.error(INFO, msg=error)
        handle_error(error, traceback.format_exc())
    finally:
        server.stop()


if __name__ == '__main__':
    try:
        # TODO ask how to handle errors before log initialized
        # TODO put asserts on config
        with open('./config.json', mode='r') as config_file:
            config_file_content = config_file.read()
            CONFIG = json.loads(config_file_content)

        UID = pwd.getpwnam(CONFIG['user']).pw_uid

        log = Log()
        log.error(DEBUG, var_name='config', var_value=CONFIG)

        start()
    except OSError as error:
        log.error(INFO, msg=error)
    except json.JSONDecodeError as error:
        log.error(INFO,
                  msg='error while parsing config file: {0}'.format(error))
