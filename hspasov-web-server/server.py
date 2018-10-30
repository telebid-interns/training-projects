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

# ROOT_DIR = (b'/media/hspasov/Files/TelebidPro/training-projects' +
#            b'/hspasov-web-server/content')

response_reason_phrases = {
    b'200': b'OK',
    b'400': b'Bad Request',
    b'404': b'Not Found',
    b'408': b'Request Timeout',
    b'500': b'Internal Server Error',
    b'503': b'Service Unavailable',
}


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


class HandleRequestState(enum.Enum):
    RECEIVING = enum.auto()
    SENDING = enum.auto()


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


def parse_req_msg(msg):
    log('function parse_req_msg called', TRACE)

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

    parsed_req_line = {
        'raw': request_line,
        'method': req_line_tokens[0],
        'req_target': urllib.parse.unquote_to_bytes(req_line_tokens[1]),
        'http_version': req_line_tokens[2],
    }
    log('parsed_req_line: {0}'.format(parsed_req_line), DEBUG)

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
        'req_line': parsed_req_line,
        'headers': headers,
        'body': body,
    }
    log('parse_req_msg result: {0}'.format(result), DEBUG)

    return result


def build_res_meta(status_code, headers={}, body=b''):
    log('function build_res_meta called', TRACE)
    log('arg status code: {0}'.format(status_code), DEBUG)
    log('arg headers: {0}'.format(headers), DEBUG)
    log('arg body: {0}'.format(body), DEBUG)

    assert_app(type(status_code) == bytes)
    assert_app(type(headers) == dict)
    assert_app(type(body) == bytes)
    assert_app(status_code in response_reason_phrases)

    result = (b'HTTP/1.1 ' + status_code + b' ' +
              response_reason_phrases[status_code])

    for field_name, field_value in headers.items():
        result += (b'\r\n' + field_name + b': ' + field_value)

    result += (b'\r\n\r\n' + body)

    log('build_res_meta result: {0}'.format(result), DEBUG)

    return result


# TODO make it a class
def handle_request(conn):
    log('function handle_request called', TRACE)
    log('conn: {0}'.format(conn), DEBUG)

    assert_app(isinstance(conn, socket.socket))

    handle_request_state = HandleRequestState.RECEIVING
    msg_received = b''

    request_meta = {
        'req_line': '-',
        'user_agent': '-',
        'content_length': '-',
    }

    try:
        while len(msg_received) <= config['req_msg_limit']:
            log('receiving data...', TRACE)

            try:
                data = conn.recv(config['recv_buffer'])
            except socket.timeout:
                log('timeout while receiving from client', TRACE)

                response = build_res_meta(b'408')

                handle_request_state = HandleRequestState.SENDING
                conn.sendall(response)

                return request_meta

            log('data received: {0}'.format(data), DEBUG)

            msg_received += data

            if len(data) <= 0:
                log('connection closed by peer', TRACE)
                return request_meta

            if msg_received.find(b'\r\n\r\n') != -1:
                log('reached end of request meta', TRACE)
                break
        else:
            # TODO handle long messages
            log('request message too long', TRACE)

            response = build_res_meta(b'400')

            handle_request_state = HandleRequestState.SENDING
            conn.sendall(response)

            return request_meta

        log('parsing request message...', TRACE)

        request_data = parse_req_msg(msg_received)
        log('request_data: {0}'.format(request_data), DEBUG)

        request_meta['req_line'] = request_data['req_line']['raw'].decode('utf-8')

        if 'User-Agent' in request_data['headers']:
            request_meta['user_agent'] = request_data['headers']['User-Agent']

        log('resolving file_path...', TRACE)

        # ignoring query params
        req_target_path = request_data['req_line']['req_target'].split(b'?')[0]

        file_path = os.path.realpath(
            os.path.join(
                config['root_dir'],
                *req_target_path.split(b'/')[1:])
        )
        log('file_path: {0}'.format(file_path), DEBUG)

        if config['root_dir'] not in file_path:
            # TODO check if this is correct error handling
            log('requested file outside of web server document root', TRACE)

            response = build_res_meta(b'400')

            handle_request_state = HandleRequestState.SENDING
            conn.sendall(response)

            return request_meta

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
            response = build_res_meta(b'200', headers)

            handle_request_state = HandleRequestState.SENDING
            conn.sendall(response)

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

                conn.sendall(response)

        request_meta['content_length'] = str(content_length)

        return request_meta

    except PeerError as error:
        log('PeerError while handling request', TRACE)
        log(format(error), DEBUG)

        response = build_res_meta(b'400')
        conn.sendall(response)

        return request_meta
    except FileNotFoundError as error:
        log('FileNotFound while handling request', TRACE)
        log(format(error), DEBUG)

        response = build_res_meta(b'404')
        conn.sendall(response)

        return request_meta
    except OSError as error:
        log('OSError while handling request', TRACE)
        log(format(error), DEBUG)

        response = build_res_meta(b'503')
        conn.sendall(response)

        return request_meta
    except Exception as error:
        log('Exception while handling request', TRACE)

        if not isinstance(error, AppError):
            AppError(traceback.format_exc())

        response = build_res_meta(b'500')
        conn.sendall(response)

        return request_meta
    finally:
        log('shutting down connection', TRACE)
        try:
            conn.shutdown(socket.SHUT_RDWR)
        except OSError as error:
            if error.errno != errno.ENOTCONN:
                raise error


def start():
    log('function start called.', TRACE)

    socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    log('socket object: {0}'.format(socket_obj), DEBUG)

    socket_obj.settimeout(config['socket_operation_timeout'])

    try:
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)

        socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        log('socket option SO_REUSEADDR set', TRACE)

        socket_obj.bind((config['host'], config['port']))
        log('socket bound: {0}:{1}'.format(config['host'], config['port']),
            TRACE)

        socket_obj.listen(config['backlog'])
        log('listening... backlog: {0}'.format(config['backlog']), TRACE)

        while True:
            pid = None
            conn = None
            child_proc_status = os.EX_OSERR

            try:
                log('ready to accept connection', TRACE)

                conn, addr = socket_obj.accept()
                log('connection accepted', TRACE)
                log('connection: {0}'.format(conn), DEBUG)
                log('addr: {0}'.format(addr), DEBUG)

                pid = os.fork()
                log('after fork, pid: {0}'.format(pid), DEBUG)

                if pid == 0:  # child process
                    socket_obj.close()
                    log('child process closed cloned parent socket object',
                        TRACE)

                    # TODO make returned meta be object of class RequestMeta
                    request_meta = handle_request(conn)  # TODO Make handle_request return child proc status

                    log('{0}  {1}  {2}  {3}  {4}'.format(
                        addr[0],
                        addr[1],
                        request_meta['req_line'],
                        request_meta['user_agent'],
                        request_meta['content_length']
                    ), INFO)
            except OSError as error:
                log('OSError thrown in main loop', TRACE)
                log(format(error), INFO)
                log('Exception thrown in main loop', TRACE)

                if not isinstance(error, AppError):
                    AppError(traceback.format_exc())
            finally:
                log('Finally block executing in main loop', TRACE)

                if isinstance(conn, socket.socket):
                    try:
                        conn.close()
                    except Exception as error:
                        log('Exception thrown while closing connection', TRACE)
                        log(format(error), INFO)

                if pid == 0:
                    os._exit(child_proc_status)
    except OSError as error:
        log('OSError thrown while initializing web server', TRACE)
        log(format(error), INFO)
        return
    except Exception as error:
        log('Exception thrown while initializing web server', TRACE)

        if not isinstance(error, AppError):
            AppError(traceback.format_exc())
    finally:
        if isinstance(socket_obj, socket.socket):
            socket_obj.close()


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
