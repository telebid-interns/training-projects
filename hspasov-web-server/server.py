import os
import sys
import socket
import traceback

print(os.getpid())

# TODO make config
RECV_BUFFER = 1024
REQ_MSG_LIMIT = 8192
BACKLOG = 1
ROOT_DIR = (b'/home/hristo/Documents/training-projects' +
            b'/hspasov-web-server/content')
# ROOT_DIR = (b'/media/hspasov/Files/TelebidPro/training-projects' +
#            b'/hspasov-web-server/content')


response_reason_phrases = {
    b'200': b'OK',
    b'404': b'Not Found',
}


class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg


class AppError(BaseError):
    def __init__(self):
        super().__init__('')


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


def log(msg):
    print(msg)


def parse_req_line(req_line):
    assert_app(type(req_line) == bytes)

    req_line_tokens = req_line.split(b' ')

    assert_peer(len(req_line_tokens) == 3, 'Invalid request')

    method = req_line_tokens[0]
    req_target = req_line_tokens[1]
    http_version = req_line_tokens[2]

    result = {
        'method': method,
        'req_target': req_target,
        'http_version': http_version,
    }

    return result


def parse_headers(header_fields):
    assert_app(type(header_fields) == list)

    headers = {}

    for header_field in header_fields:
        header_field_split = header_field.split(b':', 1)

        assert_peer(
            len(header_field_split[0]) == len(header_field_split[0].strip()),
            'Invalid request'
        )

        field_name = header_field_split[0]
        field_value = header_field_split[1].strip()

        headers[field_name] = field_value

    return headers


def parse_req_msg(msg):
    assert_app(type(msg) == bytes)

    msg_parts = msg.split(b'\r\n\r\n')

    assert_peer(len(msg_parts) == 2, 'Invalid request')
# TODO request line, not status line
    request_line_and_headers = msg_parts[0].split(b'\r\n')
    request_line = request_line_and_headers[0]
    headers = parse_headers(request_line_and_headers[1:])

    assert_app(type(headers) == dict)

    body = msg_parts[1]

    parsed_req_line = parse_req_line(request_line)

    result = {
        'request_line': parsed_req_line,
        'headers': headers,
        'body': body,
    }

    return result


def build_res_msg(status_code, body=b''):
    assert_app(type(status_code) == bytes)
    assert_app(type(body) == bytes)
    assert_app(status_code in response_reason_phrases)

    result = (b'HTTP/1.1 ' + status_code + b' ' +
              response_reason_phrases[status_code] + b'\r\n\r\n' + body)

    return result


def handle_request(conn):
    msg_received = b''

    try:
        while len(msg_received) <= REQ_MSG_LIMIT:
            msg_received += conn.recv(RECV_BUFFER)

            if msg_received.find(b'\r\n\r\n') != -1:
                break
        else:
            # TODO msg too long
            pass

        request_data = parse_req_msg(msg_received)

        print('Request data:')
        print(request_data)

        response = None

        file_path = ROOT_DIR + request_data['request_line']['req_target']

        with open(file_path, 'rb') as content_file:
            content = content_file.read()
            response = build_res_msg(b'200', content)

        conn.sendall(response)
    except FileNotFoundError as e:
        print('file not found')
        print(e)
        response = build_res_msg(b'404')

        conn.sendall(response)
    finally:
        conn.close()


def start():
    socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        socket_obj.bind((host, port))
    except OSError as e:
        socket_obj.close()
        print(e)

    socket_obj.listen(BACKLOG)

    try:
        while True:
            conn, addr = socket_obj.accept()
            print('Connected with {0}:{1}'.format(addr[0], addr[1]))

            pid = os.fork()  # may throw OSError

            if pid == 0:  # child process
                socket_obj.close()
                handle_request(conn)
                sys.exit()  # TODO os.exit() or os._exit()
            else:  # parent process
                conn.close()
    except KeyboardInterrupt as e:
        print('keyboard interrupt caught')
        socket_obj.close()
    finally:
        socket_obj.close()


if __name__ == '__main__':
    try:
        start()
    except AppError as error:
        log(error)
        log(traceback.print_stack())
