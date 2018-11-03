import inspect
import errno
import traceback
import os
import sys
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
        log.error(INFO, msg=(msg + format(tb)))


class PeerError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


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

        assert_app(type(msg) == bytes)

        msg_parts = msg.split(b'\r\n\r\n', 1)
        log.error(DEBUG, var_name='msg_parts', var_value=msg_parts)

        assert_peer(len(msg_parts) == 2, 'Invalid request')

        request_line_and_headers = msg_parts[0].split(b'\r\n')
        log.error(DEBUG, var_name='request_line_and_headers',
                  var_value=request_line_and_headers)

        request_line = request_line_and_headers[0]
        log.error(DEBUG, var_name='request_line',
                  var_value=request_line)

        req_line_tokens = request_line.split(b' ')
        log.error(DEBUG, var_name='req_line_tokens',
                  var_value=req_line_tokens)

        assert_peer(len(req_line_tokens) == 3, 'Invalid request')

        headers = {}

        log.error(DEBUG, var_name='headers not parsed',
                  var_value=request_line_and_headers[1:])

        for header_field in request_line_and_headers[1:]:
            header_field_split = header_field.split(b':', 1)

            assert_peer(
                len(header_field_split[0]) == len(
                    header_field_split[0].strip()
                ),
                'Invalid request'
            )

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

        assert_app(type(status_code) == bytes)
        assert_app(type(headers) == dict)
        assert_app(type(body) == bytes)
        assert_app(status_code in HTTP1_1MsgFormatter.response_reason_phrases)

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

        assert_app(isinstance(conn, socket.socket))
        assert_app(isinstance(addr, tuple))
        assert_app(len(addr) == 2)
        assert_app(isinstance(addr[0], str))
        assert_app(isinstance(addr[1], int))

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

        log.error(DEBUG, var_name='request meta',
                  var_value=self.req_meta)

    def receive(self):
        log.error(TRACE)
        return self._conn.recv(config['recv_buffer'])

    def send_meta(self, status_code, headers={}):
        log.error(TRACE)
        log.error(DEBUG, var_name='status_code', var_value=status_code)
        log.error(DEBUG, var_name='headers', var_value=headers)

        assert_app(type(status_code) == bytes)
        assert_app(type(headers) == dict)

        self.state = self.State.SENDING

        result = HTTP1_1MsgFormatter.build_res_meta(status_code, headers)

        log.error(DEBUG, var_name='result', var_value=result)

        self._conn.sendall(result)

    def send(self, data):
        log.error(TRACE)

        assert_app(isinstance(data, bytes))

        self._conn.sendall(data)

    def shutdown(self):
        log.error(TRACE)
        self._conn.shutdown(socket.SHUT_RDWR)

    def close(self):
        log.error(TRACE)
        self._conn.close()
        self.state = self.State.CLOSED


class Server:
    def __init__(self):
        log.error(TRACE)
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)

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

                        assert_app(isinstance(
                            client_conn.req_meta, RequestMeta))
                        assert_app(
                            isinstance(client_conn.req_meta.target, bytes))

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

                            self.res_meta.content_length = os.path.getsize(
                                file_path)

                            log.error(DEBUG, var_name='content_length',
                                      var_value=self.res_meta.content_length)

                            self.res_meta.headers[b'Content-Length'] = bytes(
                                str(self.res_meta.content_length), 'utf-8'
                            )
                            client_conn.send_meta(b'200',
                                                  self.res_meta.headers)

                            self.res_meta.packages_sent = 1

                            while True:
                                response = content_file.read(
                                    config['read_buffer'])
                                log.error(DEBUG, var_name='response',
                                          var_value=response)

                                if len(response) <= 0:
                                    log.error(TRACE, msg=('end of file reach' +
                                                          'ed while reading'))
                                    break

                                self.res_meta.packages_sent += 1
                                log.error(TRACE,
                                          msg=('sending response.. ' +
                                               'response_packages_' +
                                               'sent: {0}'.format(
                                                 self.res_meta.packages_sent)))

                                client_conn.send(response)

                    except PeerError as error:
                        log.error(TRACE, msg='PeerError')
                        log.error(DEBUG, msg=error)

                        if client_conn.state in (
                            ClientConnection.State.ESTABLISHED,
                            ClientConnection.State.RECEIVING
                        ):

                            client_conn.send_meta(b'400')
                    except FileNotFoundError as error:
                        log.error(TRACE, msg='FileNotFoundError')
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
                    except Exception as error:
                        if not isinstance(error, AppError):
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

    def stop(self):
        log.error(TRACE)
        self._conn.close()


def assert_app(condition):
    if not isinstance(condition, bool):
        raise AppError('Condition is not boolean', traceback.format_stack())

    if not condition:
        raise AppError(tb=traceback.format_stack())


def assert_peer(condition, msg):
    if not isinstance(condition, bool):
        raise AppError('Condition is not boolean', traceback.format_stack())

    if not condition:
        raise PeerError(msg)


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
    def error(self, lvl, var_name=None, var_value=None, msg=None):
        with open(config['error_log'], mode='a') as error_log_file:
            if lvl <= config['error_log_level']:
                fields = []

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

            print(config['error_log_field_sep'].join(fields), file=sys.stdout)

    def access(self, lvl, address=None, req_line=None, user_agent=None,
               content_length=None):
        with open(config['access_log'], mode='a') as access_log_file:
            if lvl <= config['access_log_level']:
                fields = []

                if 'pid' in config['access_log_fields']:
                    fields.append(format(os.getpid()))
                if 'timestamp' in config['access_log_fields']:
                    fields.append(format(datetime.now()))
                if 'address' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_field']
                        if address is None else format(address))
                if 'req_line' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_fields']
                        if req_line is None else format(req_line))
                if 'user_agent' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_fields']
                        if user_agent is None else format(user_agent))
                if 'content_length' in config['access_log_fields']:
                    fields.append(
                        config['access_log_empty_fields']
                        if content_length is None else format(content_length))

            print(config['access_log_field_sep'].join(fields), file=sys.stdout)


def start():
    log.error(TRACE)

    server = Server()

    try:
        server.run()
    except OSError as error:
        log.error(TRACE, msg='OSError thrown while initializing web server')
        log.error(INFO, msg=error)
    except Exception as error:
        log.error(TRACE, msg='Exception thrown while initializing web server')

        if not isinstance(error, AppError):
            AppError(tb=traceback.format_stack())
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
