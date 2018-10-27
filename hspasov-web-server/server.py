import traceback
import os
import socket
from datetime import datetime
import json

# ROOT_DIR = (b'/media/hspasov/Files/TelebidPro/training-projects' +
#            b'/hspasov-web-server/content')

response_reason_phrases = {
    b'200': b'OK',
    b'400': b'Bad Request',
    b'404': b'Not Found',
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
        log(msg, 1)


class PeerError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


class UserError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)


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


def log(msg, lvl):
    # Log levels:
    # 0 - no logging
    # 1 - log basic request information
    # 2 - log basic debug information
    # 3 - log everything
    assert_app(isinstance(msg, str))
    assert_app(isinstance(lvl, int))
    assert_app(lvl >= 1 and lvl <= 3)

    if lvl <= config['log_level']:
        with open(config['log_file'], mode='a') as log_file:
            print('{0}:({1}): {2}'.format(os.getpid(), datetime.now(), msg))


def parse_req_msg(msg):
    log('function parse_req_msg called', 2)

    assert_app(type(msg) == bytes)

    msg_parts = msg.split(b'\r\n\r\n')
    log('msg_parts: {0}'.format(msg_parts), 3)

    assert_peer(len(msg_parts) == 2, 'Invalid request')

    request_line_and_headers = msg_parts[0].split(b'\r\n')
    log('request_line_and_headers: {0}'.format(request_line_and_headers), 3)

    request_line = request_line_and_headers[0]
    log('request_line: {0}'.format(request_line), 3)

    req_line_tokens = request_line.split(b' ')
    log('req_line_tokens: {0}'.format(req_line_tokens), 3)

    assert_peer(len(req_line_tokens) == 3, 'Invalid request')

    parsed_req_line = {
        'method': req_line_tokens[0],
        'req_target': req_line_tokens[1],
        'http_version': req_line_tokens[2],
    }
    log('parsed_req_line: {0}'.format(parsed_req_line), 3)

    headers = {}

    log('headers not parsed: {0}'.format(request_line_and_headers[1:]), 3)

    for header_field in request_line_and_headers[1:]:
        log('header_field: {0}'.format(header_field), 3)

        header_field_split = header_field.split(b':', 1)
        log('header_field_split: {0}'.format(header_field_split), 3)

        assert_peer(
            len(header_field_split[0]) == len(header_field_split[0].strip()),
            'Invalid request'
        )

        field_name = header_field_split[0]
        log('field_name: {0}'.format(field_name), 3)

        field_value = header_field_split[1].strip()
        log('field_value: {0}'.format(field_value), 3)

        headers[field_name] = field_value

    log('headers: {0}'.format(headers), 3)

    body = msg_parts[1]
    log('body: {0}'.format(body), 3)

    result = {
        'req_line': parsed_req_line,
        'headers': headers,
        'body': body,
    }
    log('parse_req_msg result: {0}'.format(result), 3)

    return result


def add_res_meta(status_code, headers={}, body=b''):
    log('function add_res_meta called', 2)
    log('arg status code: {0}'.format(status_code), 3)
    log('arg headers: {0}'.format(headers), 3)
    log('arg body: {0}'.format(body), 3)

    assert_app(type(status_code) == bytes)
    assert_app(type(headers) == dict)
    assert_app(type(body) == bytes)
    assert_app(status_code in response_reason_phrases)

    result = (b'HTTP/1.1 ' + status_code + b' ' +
              response_reason_phrases[status_code])

    for field_name, field_value in headers.items():
        result += (b'\r\n' + field_name + b': ' + field_value)

    result += (b'\r\n\r\n' + body)

    log('add_res_meta result: {0}'.format(result), 3)

    return result


def handle_request(conn):
    log('function handle_request called', 2)
    log('conn: {0}'.format(conn), 3)

    assert_app(isinstance(conn, socket.socket))

    msg_received = b''

    try:
        while len(msg_received) <= config['req_msg_limit']:
            log('receiving data...', 2)

            data = conn.recv(config['recv_buffer'])
            log('data received: {0}'.format(data), 3)

            msg_received += data

            if len(data) <= 0:
                log('connection closed by peer', 2)

                response = add_res_meta(b'400')
                conn.sendall(response)

                return

            if msg_received.find(b'\r\n\r\n') != -1:
                log('reached end of request meta', 2)
                break
        else:
            log('request message too long', 2)

            response = add_res_meta(b'400')
            conn.sendall(response)

            return

        log('parsing request message...', 2)

        request_data = parse_req_msg(msg_received)  # TODO may throw PeerError
        log('request_data: {0}'.format(request_data), 3)

        log('resolving file_path...', 2)

        file_path = os.path.realpath(
            os.path.join(
                config['root_dir'],
                *request_data['req_line']['req_target'].split(b'/')[1:])
        )
        log('file_path: {0}'.format(file_path), 3)

        if config['root_dir'] not in file_path:
            # TODO check if this is correct error handling
            log('requested file outside of web server document root', 2)

            response = add_res_meta(b'400')
            conn.sendall(response)

            return

        log('requested file in web server document root', 2)

        with open(file_path, mode='rb') as content_file:
            log('requested file opened', 2)

            response_packages_sent = 0

            while True:
                content = content_file.read(config['read_buffer'])
                log('content: {0}'.format(content), 3)

                if len(content) <= 0:
                    log('end of file reached while reading', 2)
                    break
                if response_packages_sent == 0:
                    log(('going to send first response package.' +
                         'adding res meta...'), 2)

                    content_length = os.path.getsize(file_path)
                    log('content_length: {0}'.format(content_length), 3)

                    headers = {
                        b'Content-Length': bytes(str(content_length), 'utf-8')
                    }
                    response = add_res_meta(b'200', headers, content)
                else:
                    response = content

                log('response: {0}'.format(response), 3)

                response_packages_sent += 1
                log('sending response.. response_packages_sent: {0}'.format(
                    response_packages_sent), 2)

                conn.sendall(response)

    except PeerError as error:
        log('PeerError while handling request', 2)
        log(format(error), 3)

        response = add_res_meta(b'400')
        conn.sendall(response)
    except FileNotFoundError as error:
        log('FileNotFound while handling request', 2)
        log(format(error), 3)

        response = add_res_meta(b'404')
        conn.sendall(response)
    except OSError as error:
        log('OSError while handling request', 2)
        log(format(error), 3)

        response = add_res_meta(b'503')
        conn.sendall(response)
    except Exception as error:
        log('Exception while handling request', 2)

        if not isinstance(error, AppError):
            AppError(traceback.format_exc())

        response = add_res_meta(b'500')
        conn.sendall(response)
    finally:
        log('shutting down connection', 2)
        conn.shutdown(socket.SHUT_RDWR)


def start():
    log('function start called.', 2)

    socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    log('socket object: {0}'.format(socket_obj), 3)

    try:
        socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        log('socket option SO_REUSEADDR set', 2)

        socket_obj.bind((config['host'], config['port']))
        log('socket bound: {0}:{1}'.format(config['host'], config['port']), 2)

        socket_obj.listen(config['backlog'])
        log('listening... backlog: {0}'.format(config['backlog']), 2)

        while True:
            pid = None
            conn = None
            child_proc_status = os.EX_OSERR

            try:
                log('ready to accept connection', 2)

                conn, addr = socket_obj.accept()
                log('connection accepted', 2)
                log('connection: {0}'.format(conn), 3)
                log('addr: {0}'.format(addr), 3)

                pid = os.fork()
                log('after fork, pid: {0}'.format(pid), 3)

                if pid == 0:  # child process
                    socket_obj.close()
                    log('child process closed cloned parent socket object', 2)

                    handle_request(conn)  # TODO Make handle_request return information to log and child proc status also

                    log('{0}:{1} request handled'.format(addr[0], addr[1]), 1)
            except OSError as error:
                log('OSError thrown in main loop', 2)
                log(format(error), 1)
            except Exception as error:
                log('Exception thrown in main loop', 2)

                if not isinstance(error, AppError):
                    AppError(traceback.format_exc())
            finally:
                log('Finally block executing in main loop', 2)

                if isinstance(conn, socket.socket):
                    try:
                        conn.close()
                    except Exception as error:
                        log('Exception thrown while closing connection', 2)
                        log(format(error), 1)

                if pid == 0:
                    os._exit(child_proc_status)
    except OSError as error:
        log('OSError thrown while initializing web server', 2)
        log(format(error), 1)
        return
    except Exception as error:
        log('Exception thrown while initializing web server', 2)

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

            log('config loaded: {0}'.format(config), 3)

        start()
    except OSError as error:
        log(format(error), 1)
    except json.JSONDecodeError as error:
        log('error while parsing config file: {0}'.format(error), 1)
