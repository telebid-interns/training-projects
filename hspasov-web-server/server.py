import inspect
import errno
import traceback
import os
import sys
import socket
import signal
import urllib.parse
import enum
from datetime import datetime
import json

# "/home/hristo/Documents/training-projects/hspasov-web-server/content",
# "/home/hristo/Documents/training-projects/hspasov-web-server/logs/access.log",

# ROOT_DIR = (b'/media/hspasov/Files/TelebidPro/training-projects' +
#            b'/hspasov-web-server/content')


class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg


class AppError(BaseError):
    def __init__(self, msg=''):
        super().__init__(msg)
        log.error(INFO, msg=msg)


class PeerError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


class UserError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


# class RequestMeta:
#    req_line


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
        log.error(DEBUG, var_name='msg_parts', var_value=format(msg_parts))

        assert_peer(len(msg_parts) == 2, 'Invalid request')

        request_line_and_headers = msg_parts[0].split(b'\r\n')
        log.error(DEBUG, var_name='request_line_and_headers',
                  var_value=format(request_line_and_headers))

        request_line = request_line_and_headers[0]
        log.error(DEBUG, var_name='request_line',
                  var_value=format(request_line))

        req_line_tokens = request_line.split(b' ')
        log.error(DEBUG, var_name='req_line_tokens',
            var_value=format(req_line_tokens))

        assert_peer(len(req_line_tokens) == 3, 'Invalid request')

        headers = {}

        log.error(DEBUG, var_name='headers not parsed',
            var_value=format(request_line_and_headers[1:]))

        for header_field in request_line_and_headers[1:]:
            log.error(DEBUG, var_name='header_field',
                      var_value=format(header_field))

            header_field_split = header_field.split(b':', 1)
            log.error(DEBUG, var_name='header_field_split',
                var_value=format(header_field_split))

            assert_peer(
                len(header_field_split[0]) == len(header_field_split[0].strip()),
                'Invalid request'
            )

            field_name = header_field_split[0]
            log.error(DEBUG, var_name='field_name',
                      var_value=format(field_name))

            field_value = header_field_split[1].strip()
            log.error(DEBUG, var_name='field_value',
                      var_value=format(field_value))

            headers[field_name] = field_value

        log.error(DEBUG, var_name='headers', var_value=format(headers))

        body = msg_parts[1]
        log.error(DEBUG, var_name='body', var_value=format(body))

        result = {
            'req_line_raw': request_line,
            'method': req_line_tokens[0],
            'target': urllib.parse.unquote_to_bytes(req_line_tokens[1]),
            'http_version': req_line_tokens[2],
            'headers': headers,
            'body': body,
        }
        log.error(DEBUG, var_name='result', var_value=format(result))

        return result

    @staticmethod
    def build_res_meta(status_code, headers={}, body=b''):
        log.error(TRACE)
        log.error(DEBUG, var_name='status_code', var_value=format(status_code))
        log.error(DEBUG, var_name='headers', var_value=format(headers))
        log.error(DEBUG, var_name='body', var_value=format(body))

        assert_app(type(status_code) == bytes)
        assert_app(type(headers) == dict)
        assert_app(type(body) == bytes)
        assert_app(status_code in HTTP1_1MsgFormatter.response_reason_phrases)

        result = (b'HTTP/1.1 ' + status_code + b' ' +
                  HTTP1_1MsgFormatter.response_reason_phrases[status_code])

        for field_name, field_value in headers.items():
            result += (b'\r\n' + field_name + b': ' + field_value)

        result += (b'\r\n\r\n' + body)

        log.error(DEBUG, var_name='result', var_value=format(result))

        return result


class ClientConnection:
    class State(enum.Enum):
        ESTABLISHED = enum.auto()
        RECEIVING = enum.auto()
        SENDING = enum.auto()
        CLOSED = enum.auto()

    def __init__(self, conn):
        assert_app(isinstance(conn, socket.socket))

        self._conn = conn
        self._conn.settimeout(config['socket_operation_timeout'])
        self._msg_received = b''
        self.state = self.State.ESTABLISHED
        self.meta = {
            'req_line': '-',
            'user_agent': '-',
            'content_length': '-',
        }

    def receive_meta(self):
        self.state = self.State.RECEIVING

        while len(self._msg_received) <= config['req_msg_limit']:
            log.error(TRACE, msg='receiving data...')

            try:
                data = self.receive()
            except socket.timeout:
                log.error(TRACE, msg='timeout while receiving from client')

                self.send_meta(b'408')

                return

            log.error(DEBUG, var_name='data', var_value=format(data))

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

        self.meta = HTTP1_1MsgFormatter.parse_req_meta(self._msg_received)
        self.meta['req_line_raw'] = self.meta['req_line_raw'].decode('utf-8')

        if 'User-Agent' in self.meta['headers']:
            self.meta['user_agent'] = self.meta['headers']['User-Agent']

        log.error(DEBUG, var_name='request meta', var_value=format(self.meta))

    def receive(self):
        return self._conn.recv(config['recv_buffer'])

    def send_meta(self, status_code, headers={}):
        log.error(TRACE)
        log.error(DEBUG, var_name='status_code', var_value=format(status_code))
        log.error(DEBUG, var_name='headers', var_value=format(headers))

        assert_app(type(status_code) == bytes)
        assert_app(type(headers) == dict)

        self.state = self.State.SENDING

        result = HTTP1_1MsgFormatter.build_res_meta(status_code, headers)

        log.error(DEBUG, var_name='result', var_value=format(result))

        self._conn.sendall(result)

    def send(self, data):
        self._conn.sendall(data)

    def shutdown(self):
        self._conn.shutdown(socket.SHUT_RDWR)

    def close(self):
        self._conn.close()
        self.state = self.State.CLOSED


class Server:
    def __init__(self):
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)

        self._conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._conn.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        log.error(TRACE, msg='socket option SO_REUSEADDR set')

    def run(self):
        self._conn.bind((config['host'], config['port']))
        log.error(TRACE, msg='socket bound: {0}:{1}'.format(config['host'],
                                                            config['port']))

        self._conn.listen(config['backlog'])
        log.error(TRACE,
                  msg='listening... backlog: {0}'.format(config['backlog']))

        while True:
            try:
                client_connection = self.accept()

                pid = os.fork()

                if pid == 0:  # child process
                    self.stop()

                    try:
                        # may send response to client in case of peer error
                        client_connection.receive_meta()

                        if client_connection.state != ClientConnection.State.RECEIVING:
                            client_connection.close()
                            continue

                        log.error(TRACE, msg='resolving file_path...')

                        # ignoring query params
                        req_target_path = client_connection.meta['target'].split(b'?')[0]

                        file_path = os.path.realpath(
                            os.path.join(
                                config['root_dir'],
                                *req_target_path.split(b'/')[1:])
                        )
                        log.error(DEBUG, var_name='file_path',
                                  var_value=format(file_path))

                        if config['root_dir'] not in file_path:
                            # TODO check if this is correct error handling
                            log.error(TRACE,
                                      msg=('requested file outside of ' +
                                           'web server document root'))

                            client_connection.send_meta(b'400')

                        log.error(TRACE, msg=('requested file in web server ' +
                                          'document root'))

                        with open(file_path, mode='rb') as content_file:
                            log.error(TRACE, msg='requested file opened')

                            log.error(TRACE, msg=('going to send first ' +
                                                  'response package. ' +
                                                  'adding res meta...'))

                            content_length = os.path.getsize(file_path)
                            log.error(DEBUG, var_name='content_length',
                                var_value=format(content_length))

                            headers = {
                                b'Content-Length': bytes(str(content_length), 'utf-8')
                            }
                            client_connection.send_meta(b'200', headers)

                            response_packages_sent = 1

                            while True:
                                response = content_file.read(config['read_buffer'])
                                log.error(DEBUG, var_name='response',
                                          var_value=format(response))

                                if len(response) <= 0:
                                    log.error(TRACE, msg=('end of file reach' +
                                                          'ed while reading'))
                                    break

                                response_packages_sent += 1
                                log.error(TRACE, msg=('sending response.. ' +
                                                      'response_packages_' +
                                                      'sent: {0}'.format(
                                                        response_packages_sent
                                                      )))

                                client_connection.send(response)

                        client_connection.meta['content_length'] = str(content_length)
                    except PeerError as error:
                        if client_connection.state in (ClientConnection.State.ESTABLISHED, ClientConnection.State.RECEIVING):
                            client_connection.send_meta(b'400')
                    except FileNotFoundError as error:
                        if client_connection.state in (ClientConnection.State.ESTABLISHED, ClientConnection.State.RECEIVING):
                            client_connection.send_meta(b'404')
                    except OSError as error:
                        if client_connection.state in (ClientConnection.State.ESTABLISHED, ClientConnection.State.RECEIVING):
                            client_connection.send_meta(b'503')
                    except Exception as error:
                        if not isinstance(error, AppError):
                            AppError(traceback.format_exc())

                        if client_connection.state in (ClientConnection.State.ESTABLISHED, ClientConnection.State.RECEIVING):
                            client_connection.send_meta(b'500')
                    finally:
                        try:
                            client_connection.shutdown()
                        except OSError as error:
                            if error.errno != errno.ENOTCONN:
                                raise error

            except OSError as error:
                # TODO log
                ...
            finally:
                if client_connection.state != ClientConnection.State.CLOSED:
                    try:
                        client_connection.close()
                    except Exception as error:
                        # TODO log
                        ...

                if pid == 0:
                    os._exit(os.EX_OSERR)  # TODO change os.EX_OSERR

    def accept(self):
        log.error(TRACE, msg='ready to accept connection')

        conn, addr = self._conn.accept()
        log.error(TRACE, msg='connection accepted')
        log.error(DEBUG, var_name='conn', var_value=format(conn))
        log.error(DEBUG, var_name='addr', var_value=format(addr))

        return ClientConnection(conn)

    def stop(self):
        self._conn.close()


def assert_app(condition):
    if not isinstance(condition, bool):
        raise AppError('Condition is not boolean')

    if not condition:
        raise AppError()


def assert_peer(condition, msg):
    if not isinstance(condition, bool):
        raise AppError('Condition is not boolean')

    if not condition:
        raise PeerError(msg)


def assert_user(condition, msg):
    if not isinstance(condition, bool):
        raise AppError('Condition is not boolean')

    if not condition:
        raise UserError(msg)


# error log levels
INFO = 1
TRACE = 2
DEBUG = 3


class Log:
    def __init__(self):
        self.error_log_file = open(config['error_log'], mode='a')
        self.access_log_file = open(config['access_log'], mode='a')

    def error(self, lvl, var_name=None, var_value=None, msg=None):
        if lvl <= config['error_log_level']:
            fields = []

            if 'pid' in config['error_log_fields']:
                fields.append(str(os.getpid()))
            if 'timestamp' in config['error_log_fields']:
                fields.append(str(datetime.now()))
            if 'level' in config['error_log_fields']:
                fields.append(str(lvl))
            if 'context' in config['error_log_fields']:
                current_frame = inspect.currentframe()
                caller_frame = inspect.getouterframes(current_frame, 2)
                caller_function = caller_frame[1][3]
                fields.append(caller_function)
            if 'var_name' in config['error_log_fields']:
                fields.append(
                    config['error_log_empty_field']
                    if var_name is None else var_name)
            if 'var_value' in config['error_log_fields']:
                fields.append(
                    config['error_log_empty_field']
                    if var_value is None else var_value)
            if 'msg' in config['error_log_fields']:
                fields.append(
                    config['error_log_empty_field'] if msg is None else msg)

            print(config['error_log_field_sep'].join(fields), file=sys.stdout)

    def access(self, lvl, address=None, req_line=None, user_agent=None,
               content_length=None):
        if lvl <= config['access_log_level']:
            fields = []

            if 'pid' in config['access_log_fields']:
                fields.append(str(os.getpid()))
            if 'timestamp' in config['access_log_fields']:
                fields.append(str(datetime.now()))
            if 'address' in config['access_log_fields']:
                fields.append(
                    config['access_log_empty_field']
                    if address is None else address)
            if 'req_line' in config['access_log_fields']:
                fields.append(
                    config['access_log_empty_fields']
                    if req_line is None else req_line)
            if 'user_agent' in config['access_log_fields']:
                fields.append(
                    config['access_log_empty_fields']
                    if user_agent is None else user_agent)
            if 'content_length' in config['access_log_fields']:
                fields.append(
                    config['access_log_empty_fields']
                    if content_length is None else content_length)

            print(config['access_log_field_sep'].join(fields), file=sys.stdout)


def start():
    log.error(TRACE)

    server = Server()

    try:
        server.run()
    except OSError as error:
        log.error(TRACE, msg='OSError thrown while initializing web server')
        log.error(INFO, msg=format(error))
    except Exception as error:
        log.error(TRACE, msg='Exception thrown while initializing web server')

        if not isinstance(error, AppError):
            AppError(traceback.format_exc())
    finally:
        server.stop()


if __name__ == '__main__':
    try:
        with open('./config.json', mode='r') as config_file:
            config_file_content = config_file.read()
            config = json.loads(config_file_content)

            # root dir needs to be bytes so that file path received from http
            # request can be directly concatenated to root dir
            config['root_dir'] = bytes(config['root_dir'], 'utf-8')

        log = Log()
        log.error(DEBUG, var_name='config', var_value=format(config))

        start()
    except OSError as error:
        log.error(INFO, msg=format(error))
    except json.JSONDecodeError as error:
        log.error(INFO,
                  msg='error while parsing config file: {0}'.format(error))
