import traceback
import os
import sys
import socket
import signal
import urllib.parse
import enum
from datetime import datetime
import json

# ROOT_DIR = (b'/media/hspasov/Files/TelebidPro/training-projects' +
#            b'/hspasov-web-server/content')


class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg


class AppError(BaseError):
    def __init__(self, msg=''):
        super().__init__(msg)
        log(msg, INFO)


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
        log('function parse_req_meta called', TRACE)

        assert_app(type(msg) == bytes)

        msg_parts = msg.split(b'\r\n\r\n', 1)
        log('msg_parts: {0}'.format(msg_parts), DEBUG)

        assert_peer(len(msg_parts) == 2, 'Invalid request')

        request_line_and_headers = msg_parts[0].split(b'\r\n')
        log('request_line_and_headers: {0}'.format(request_line_and_headers),
            DEBUG)

        request_line = request_line_and_headers[0]
        log('request_line: {0}'.format(request_line), DEBUG)

        req_line_tokens = request_line.split(b' ')
        log('req_line_tokens: {0}'.format(req_line_tokens), DEBUG)

        assert_peer(len(req_line_tokens) == 3, 'Invalid request')

        headers = {}

        log('headers not parsed: {0}'.format(request_line_and_headers[1:]), DEBUG)

        for header_field in request_line_and_headers[1:]:
            log('header_field: {0}'.format(header_field), DEBUG)

            header_field_split = header_field.split(b':', 1)
            log('header_field_split: {0}'.format(header_field_split), DEBUG)

            assert_peer(
                len(header_field_split[0]) == len(header_field_split[0].strip()),
                'Invalid request'
            )

            field_name = header_field_split[0]
            log('field_name: {0}'.format(field_name), DEBUG)

            field_value = header_field_split[1].strip()
            log('field_value: {0}'.format(field_value), DEBUG)

            headers[field_name] = field_value

        log('headers: {0}'.format(headers), DEBUG)

        body = msg_parts[1]
        log('body: {0}'.format(body), DEBUG)

        result = {
            'req_line_raw': request_line,
            'method': req_line_tokens[0],
            'target': urllib.parse.unquote_to_bytes(req_line_tokens[1]),
            'http_version': req_line_tokens[2],
            'headers': headers,
            'body': body,
        }
        log('parse_req_msg result: {0}'.format(result), DEBUG)

        return result

    @staticmethod
    def build_res_meta(status_code, headers={}, body=b''):
        log('function build_res_meta called', TRACE)
        log('arg status code: {0}'.format(status_code), DEBUG)
        log('arg headers: {0}'.format(headers), DEBUG)
        log('arg body: {0}'.format(body), DEBUG)

        assert_app(type(status_code) == bytes)
        assert_app(type(headers) == dict)
        assert_app(type(body) == bytes)
        assert_app(status_code in HTTP1_1MsgFormatter.response_reason_phrases)

        result = (b'HTTP/1.1 ' + status_code + b' ' +
                  HTTP1_1MsgFormatter.response_reason_phrases[status_code])

        for field_name, field_value in headers.items():
            result += (b'\r\n' + field_name + b': ' + field_value)

        result += (b'\r\n\r\n' + body)

        log('build_res_meta result: {0}'.format(result), DEBUG)

        return result


class ClientConnection:
    class ConnectionState(enum.Enum):
        ESTABLISHED = enum.auto()
        RECEIVING = enum.auto()
        SENDING = enum.auto()
        CLOSED = enum.auto()

    def __init__(self, conn):
        assert_app(isinstance(conn, socket.socket))

        self._conn = conn
        self._conn.settimeout(config['socket_operation_timeout'])
        self._msg_received = b''
        self.state = self.ConnectionState.ESTABLISHED
        self.meta = {
            'req_line': '-',
            'user_agent': '-',
            'content_length': '-',
        }

    def receive_meta(self):
        self.state = self.ConnectionState.RECEIVING

        while len(self._msg_received) <= config['req_msg_limit']:
            log('receiving data...', TRACE)

            try:
                data = self.receive()
            except socket.timeout:
                log('timeout while receiving from client', TRACE)

                self.send_meta(b'408')

                return

            log('data received: {0}'.format(data), DEBUG)

            self._msg_received += data

            if len(data) <= 0:
                log('connection closed by peer', TRACE)

                return

            if self._msg_received.find(b'\r\n\r\n') != -1:
                log('reached end of request meta', TRACE)
                break
        else:
            # TODO handle long messages
            log('request message too long', TRACE)

            self.send_meta(b'400')

            return

        log('parsing request message...', TRACE)

        self.meta = HTTP1_1MsgFormatter.parse_req_meta(self._msg_received)
        self.meta['req_line_raw'] = self.meta['req_line_raw'].decode('utf-8')

        if 'User-Agent' in self.meta['headers']:
            self.meta['user_agent'] = self.meta['headers']['User-Agent']

        log('request meta: {0}'.format(self.meta), DEBUG)

    def receive(self):
        return self._conn.recv(config['recv_buffer'])

    def send_meta(self, status_code, headers={}):
        log('function send_meta called', TRACE)
        log('arg status code: {0}'.format(status_code), DEBUG)
        log('arg headers: {0}'.format(headers), DEBUG)

        assert_app(type(status_code) == bytes)
        assert_app(type(headers) == dict)

        self.state = self.ConnectionState.SENDING

        result = HTTP1_1MsgFormatter.build_res_meta(status_code, headers)

        log('build_res_meta result: {0}'.format(result), DEBUG)

        self._conn.sendall(result)

    def send(self, data):
        self._conn.sendall(data)

    def shutdown(self):
        self._conn.shutdown(socket.SHUT_RDWR)

    def close(self):
        self._conn.close()
        self.state = self.ConnectionState.CLOSED

class Server:
    def __init__(self):
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)

        self._conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._conn.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        log('socket option SO_REUSEADDR set', TRACE)

    def run(self):
        self._conn.bind((config['host'], config['port']))
        log('socket bound: {0}:{1}'.format(config['host'], config['port']),
            TRACE)

        self._conn.listen(config['backlog'])
        log('listening... backlog: {0}'.format(config['backlog']), TRACE)

        while True:
            try:
                client_connection = self.accept()

                pid = os.fork()

                if pid == 0:  # child process
                    self.stop()

                    try:
                        # may send response to client in case of peer error
                        client_connection.receive_meta()

                        # TODO rename ConnectionState to State
                        if client_connection.state != ClientConnection.ConnectionState.RECEIVING:
                            client_connection.close()
                            continue

                        log('resolving file_path...', TRACE)

                        # ignoring query params
                        req_target_path = client_connection.meta['target'].split(b'?')[0]

                        file_path = os.path.realpath(
                            os.path.join(
                                config['root_dir'],
                                *req_target_path.split(b'/')[1:])
                        )
                        log('file_path: {0}'.format(file_path), DEBUG)

                        if config['root_dir'] not in file_path:
                            # TODO check if this is correct error handling
                            log('requested file outside of web server document root', TRACE)

                            client_connection.send_meta(b'400')

                        log('requested file in web server document root', TRACE)

                        with open(file_path, mode='rb') as content_file:
                            log('requested file opened', TRACE)

                            log('going to send first response package. adding res meta...',
                                TRACE)

                            content_length = os.path.getsize(file_path)
                            log('content_length: {0}'.format(content_length), DEBUG)

                            headers = {
                                b'Content-Length': bytes(str(content_length), 'utf-8')
                            }
                            client_connection.send_meta(b'200', headers)

                            response_packages_sent = 1

                            while True:
                                response = content_file.read(config['read_buffer'])
                                log('response: {0}'.format(response), DEBUG)

                                if len(response) <= 0:
                                    log('end of file reached while reading', TRACE)
                                    break

                                response_packages_sent += 1
                                log('sending response.. response_packages_sent: {0}'.format(
                                    response_packages_sent), TRACE)

                                client_connection.send(response)

                        client_connection.meta['content_length'] = str(content_length)
                    except PeerError as error:
                    except FileNotFoundError as error:
                    except OSError as error:

                    except Exception as error:
                        if not isinstance(error, AppError):
                            AppError(traceback.format_exc())

                        if client_connection.state in (ClientConnection.ConnectionState.ESTABLISHED, ClientConnection.ConnectionState.RECEIVING):
                            client_connection.send_meta(b'500')
                    finally:
                        try:
                            client_connection.shutdown()
                        except OSError as error:
                            if error.errno != errno.ENOTCONN:
                                raise error

            except OSError as error:
                # TODO log
            finally:
                if client_connection.state != ClientConnection.ConnectionState.CLOSED:
                    try:
                        client_connection.close()
                    except Exception as error:
                        # TODO log

                if pid == 0:
                    os._exit(os.EX_OSERR)  # TODO change os.EX_OSERR

    def accept(self):
        log('ready to accept connection', TRACE)

        conn, addr = self._conn.accept()
        log('connection accepted', TRACE)
        log('connection: {0}'.format(conn), DEBUG)
        log('addr: {0}'.format(addr), DEBUG)

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


# log levels
INFO = 1
TRACE = 2
DEBUG = 3


def log(msg, lvl):
    assert_app(isinstance(msg, str))
    assert_app(isinstance(lvl, int))
    assert_app(lvl >= 1 and lvl <= 3)

    if lvl <= config['log_level']:
        with open(config['log_file'], mode='a') as log_file:
            print('{0}  ({1})  {2}'.format(os.getpid(), datetime.now(), msg),
                  file=sys.stdout)


def start():
    log('function start called.', TRACE)

    server = Server()

    try:
        server.run()
    except OSError as error:
        log('OSError thrown while initializing web server', TRACE)
        log(format(error), INFO)
    except Exception as error:
        log('Exception thrown while initializing web server', TRACE)

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

            log('config loaded: {0}'.format(config), DEBUG)

        start()
    except OSError as error:
        log(format(error), INFO)
    except json.JSONDecodeError as error:
        log('error while parsing config file: {0}'.format(error), INFO)
