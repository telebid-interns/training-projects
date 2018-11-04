import inspect
import errno
import traceback
import os
import socket
import signal
import urllib.parse
import enum
from collections import namedtuple
from datetime import datetime
import json


class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg


class AppError(BaseError):
    def __init__(self, msg='', tb=None):
        super().__init__(msg)
        log.error(INFO, msg=(format(msg) + format(tb)))


class UserError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


RequestMeta = namedtuple('RequestMeta', [
    'req_line_raw',
    'method',
    'target',
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


class HTTP1_1MsgFormatter:
    response_reason_phrases = {
        b'200': b'OK',
        b'400': b'Bad Request',
        b'404': b'Not Found',
        b'408': b'Request Timeout',
        b'500': b'Internal Server Error',
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
            req_line_raw=request_line.decode('utf-8'),
            method=req_line_tokens[0],
            target=urllib.parse.unquote_to_bytes(req_line_tokens[1]),
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
        self._addr = addr[0]
        self._port = addr[1]
        self._conn.settimeout(config['socket_operation_timeout'])
        self._msg_received = b''
        self.state = self.State.ESTABLISHED
        self.req_meta = None
        self.res_meta = ResponseMeta()

    def receive_meta(self):
        log.error(TRACE)

        self.state = self.State.RECEIVING

        while len(self._msg_received) <= config['req_msg_limit']:
            log.error(TRACE, msg='receiving data...')

            try:
                data = self.receive()
            except socket.timeout:
                log.error(TRACE, msg='timeout while receiving from client')
                self.send_meta(b'408')
                return

            log.error(DEBUG, var_name='data', var_value=data)

            self._msg_received += data

            if len(data) <= 0:
                log.error(TRACE, msg='connection closed by peer')
                return

            if self._msg_received.find(b'\r\n\r\n') != -1:
                log.error(TRACE, msg='reached end of request meta')
                break
        else:
            # TODO handle long messages
            log.error(TRACE, msg='request message too long')
            self.send_meta(b'400')
            return

        log.error(TRACE, msg='parsing request message...')

        self.req_meta = HTTP1_1MsgFormatter.parse_req_meta(self._msg_received)

        if self.req_meta is None:
            log.error(TRACE, msg='invalid request')
            self.send_meta(b'400')
            return

        log.error(DEBUG, var_name='request meta',
                  var_value=self.req_meta)

# TODO
#    def receive_body(self):
#        log.error(TRACE)

#        self.state = self.State.RECEIVING

#        assert self.req_meta.headers['']

    def receive(self):
        log.error(TRACE)
        return self._conn.recv(config['recv_buffer'])

    def send_meta(self, status_code, headers={}):
        log.error(TRACE)
        log.error(DEBUG, var_name='status_code', var_value=status_code)
        log.error(DEBUG, var_name='headers', var_value=headers)

        assert type(status_code) is bytes
        assert type(headers) is dict

        self.state = self.State.SENDING
        self.res_meta.status_code = status_code

        result = HTTP1_1MsgFormatter.build_res_meta(status_code, headers)

        log.error(DEBUG, var_name='result', var_value=result)

        self._conn.sendall(result)

    def send(self, data):
        log.error(TRACE)

        assert isinstance(data, bytes)

        self._conn.sendall(data)

    def shutdown(self):
        log.error(TRACE)
        self._conn.shutdown(socket.SHUT_RDWR)

    def close(self):
        log.error(TRACE)

        if self.req_meta is None:
            req_line = None
            user_agent = None
        else:
            req_line = self.req_meta.req_line_raw
            user_agent = self.req_meta.user_agent

        log.access(
            1,
            remote_addr='{0}:{1}'.format(self._addr, self._port),
            req_line=req_line,
            user_agent=user_agent,
            status_code=self.res_meta.status_code,
            content_length=self.res_meta.content_length,
        )

        self._conn.close()
        self.state = self.State.CLOSED


class Server:
    def __init__(self):
        log.error(TRACE)
        signal.signal(signal.SIGCHLD, self.reap_child)

        self._conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._conn.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        log.error(TRACE, msg='socket option SO_REUSEADDR set')

    def run(self):
        log.error(TRACE)
        self._conn.bind((config['host'], config['port']))
        log.error(TRACE, msg='socket bound: {0}:{1}'.format(config['host'],
                                                            config['port']))

        self._conn.listen(config['backlog'])
        log.error(TRACE,
                  msg='listening... backlog: {0}'.format(config['backlog']))

        client_conn = None
        pid = None

        while True:
            try:
                client_conn = self.accept()

                pid = os.fork()

                if pid == 0:  # child process
                    self.stop()

                    try:
                        # may send response to client in case of peer error
                        client_conn.receive_meta()

                        if client_conn.state != (
                            ClientConnection.State.RECEIVING
                        ):
                            break

                        log.error(TRACE, msg='resolving file_path...')

                        assert isinstance(client_conn.req_meta, RequestMeta)
                        assert isinstance(client_conn.req_meta.target, bytes)

                        # ignoring query params
                        req_target_path = client_conn.req_meta.target \
                            .split(b'?')[0]
                        log.error(DEBUG, var_name='req_target_path',
                                  var_value=req_target_path)

                        file_path = os.path.realpath(
                            os.path.join(
                                config['root_dir'],
                                *req_target_path.split(b'/')[1:])
                        )
                        log.error(DEBUG, var_name='file_path',
                                  var_value=file_path)

                        if config['root_dir'] not in file_path:
                            # TODO check if this is correct error handling
                            log.error(TRACE,
                                      msg=('requested file outside of ' +
                                           'web server document root'))

                            client_conn.send_meta(b'400')
                            break

                        log.error(TRACE, msg=('requested file in web server ' +
                                              'document root'))

                        with open(file_path, mode='rb') as content_file:
                            log.error(TRACE, msg='requested file opened')

                            client_conn.res_meta.content_length = \
                                os.path.getsize(file_path)

                            log.error(DEBUG, var_name='content_length',
                                      var_value=client_conn.res_meta.content_length)  # noqa

                            client_conn.res_meta.headers[b'Content-Length'] = bytes(  # noqa
                                str(client_conn.res_meta.content_length),
                                'utf-8'
                            )
                            client_conn.send_meta(b'200',
                                                  client_conn.res_meta.headers)

                            client_conn.res_meta.packages_sent = 1

                            while True:
                                response = content_file.read(
                                    config['read_buffer'])
                                log.error(DEBUG, var_name='response',
                                          var_value=response)

                                if len(response) <= 0:
                                    log.error(TRACE, msg=('end of file reach' +
                                                          'ed while reading'))
                                    break

                                log.error(TRACE,
                                          msg=('sending response.. ' +
                                               'response_packages_' +
                                               'sent: {0}'.format(client_conn.res_meta.packages_sent)))  # noqa

                                client_conn.send(response)

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
                        log.error(TRACE, msg='OSError')
                        log.error(DEBUG, msg=error)

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'503')
                    except AssertionError as error:
                        log.error(TRACE, msg='AssertionError')
                        AppError(error, traceback.format_stack())

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):
                            client_conn.send_meta(b'500')
                    except Exception as error:
                        log.error(TRACE, msg='Exception')
                        AppError(error, traceback.format_stack())

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
                                raise error

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

                if pid is not None and pid == 0:
                    os._exit(os.EX_OSERR)  # TODO change os.EX_OSERR

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

                assert (exit_status == 0 and signal_number != 0) or (
                        exit_status != 0 and signal_number == 0)

                if exit_status == 0:
                    log.error(TRACE, msg='Child pid={0} killed by signal {1}'.format(pid, signal_number)) # noqa
                else:
                    log.error(TRACE, msg='Child pid={0} exit status={1}'.format(pid, exit_status)) # noqa

    def stop(self):
        log.error(TRACE)
        self._conn.close()


def assert_user(condition, msg):
    if not isinstance(condition, bool):
        raise AppError('Condition is not boolean', traceback.format_stack())

    if not condition:
        raise UserError(msg)


# error log levels
INFO = 1
TRACE = 2
DEBUG = 3


class Log:
    def error(self, lvl, *, var_name=None, var_value=None, msg=None):
        if lvl <= config['error_log_level']:
            fields = []

            with open(config['error_log'], mode='a') as error_log_file:
                if 'pid' in config['error_log_fields']:
                    fields.append(format(os.getpid()))
                if 'timestamp' in config['error_log_fields']:
                    fields.append(format(datetime.now()))
                if 'level' in config['error_log_fields']:
                    fields.append(format(lvl))
                if 'context' in config['error_log_fields']:
                    current_frame = inspect.currentframe()
                    caller_frame = inspect.getouterframes(current_frame, 2)
                    caller_function = caller_frame[1][3]
                    fields.append(format(caller_function))
                if 'var_name' in config['error_log_fields']:
                    fields.append(
                        config['error_log_empty_field']
                        if var_name is None else format(var_name))
                if 'var_value' in config['error_log_fields']:
                    fields.append(
                        config['error_log_empty_field']
                        if var_value is None else format(var_value))
                if 'msg' in config['error_log_fields']:
                    fields.append(
                        config['error_log_empty_field']
                        if msg is None
                        else format(msg))

                print(config['error_log_field_sep'].join(fields),
                      file=error_log_file)

    def access(self, lvl, *, remote_addr=None, req_line=None, user_agent=None,
               status_code=None, content_length=None):
        if lvl <= config['access_log_level']:
            fields = []

            with open(config['access_log'], mode='a') as access_log_file:
                if 'pid' in config['access_log_fields']:
                    fields.append(format(os.getpid()))
                if 'timestamp' in config['access_log_fields']:
                    fields.append(format(datetime.now()))
                if 'remote_addr' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_field']
                        if remote_addr is None else format(remote_addr))
                if 'req_line' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_field']
                        if req_line is None else format(req_line))
                if 'user_agent' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_field']
                        if user_agent is None else format(user_agent))
                if 'status_code' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_field']
                        if status_code is None else format(status_code))
                if 'content_length' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_field']
                        if content_length is None else format(content_length))

                print(config['access_log_field_sep'].join(fields),
                      file=access_log_file)


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
        AppError(error, traceback.format_stack())
    except Exception as error:
        log.error(TRACE, msg='Exception thrown')
        AppError(error, traceback.format_stack())
    finally:
        server.stop()


if __name__ == '__main__':
    try:
        # TODO ask how to handle errors before log initialized
        with open('./config.json', mode='r') as config_file:
            config_file_content = config_file.read()
            config = json.loads(config_file_content)

            # root dir needs to be bytes so that file path received from http
            # request can be directly concatenated to root dir
            config['root_dir'] = bytes(config['root_dir'], 'utf-8')

        log = Log()
        log.error(DEBUG, var_name='config', var_value=config)

        start()
    except OSError as error:
        log.error(INFO, msg=error)
    except json.JSONDecodeError as error:
        log.error(INFO,
                  msg='error while parsing config file: {0}'.format(error))
