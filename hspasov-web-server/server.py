import socket
import traceback
from multiprocessing import Process  # , current_process


RECV_BUFFER = 4096
ROOT_DIR = ('/home/hristo/Documents/training-projects' +
            '/hspasov-web-server/content')
# ROOT_DIR = ('/media/hspasov/Files/TelebidPro/training-projects' +
#            '/hspasov-web-server/content')


class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg
        handle_error(self.msg)


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


def handle_error(error):
    log(error)
    log(traceback.print_stack())


def log(msg):
    print(msg)


host = ''
port = 8080


def parse_req_line(req_line):
    assert_app(type(req_line) == str)

    req_line_tokens = req_line.split(' ')

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
        header_field_split = header_field.split(':', 1)

        assert_peer(
            len(header_field_split[0]) == len(header_field_split[0].strip()),
            'Invalid request'
        )

        field_name = header_field_split[0]
        field_value = header_field_split[1].strip()

        headers[field_name] = field_value

    return headers


def parse_http_msg(msg):
    assert_app(type(msg) == str)

    msg_parts = msg.split('\r\n\r\n')

    assert_peer(len(msg_parts) == 2, 'Invalid request')

    start_line_and_headers = msg_parts[0].split('\r\n')
    start_line = start_line_and_headers[0]
    headers = parse_headers(start_line_and_headers[1:])

    assert_app(type(headers) == dict)

    body = msg_parts[1]

    result = {
        'start_line': start_line,
        'headers': headers,
        'body': body,
    }

    return result


def parse_req_msg(msg):
    assert_app(type(msg) == str)

    parsed_http_msg = parse_http_msg(msg)

    assert_app(type(parsed_http_msg) == dict)
    assert_app('start_line' in parsed_http_msg)

    parsed_req_line = parse_req_line(parsed_http_msg['start_line'])

    result = {
        **parsed_http_msg,
        'start_line': parsed_req_line,
    }

    return result


def build_res_msg(body):
    assert_app(type(body) == bytes)

    result = 'HTTP/1.1 200 OK\r\n\r\n'.encode() + body

    return result


def handle_request(conn):
    try:
        total_data = conn.recv(RECV_BUFFER)

        total_data_decoded = total_data.decode()

        request_data = parse_req_msg(total_data_decoded)

        print('Request data:')
        print(request_data)

        response = None

        file_path = ROOT_DIR + request_data['start_line']['req_target']

        with open(file_path, 'rb') as content_file:
            content = content_file.read()
            response = build_res_msg(content)

        conn.sendall(response)
        conn.close()
    except Exception as e:
        print('Exception')
        print(e)


def start():
    socket_descr = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    socket_descr.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    socket_descr.bind((host, port))

    socket_descr.listen(1)

    while True:
        conn, addr = socket_descr.accept()
        print('Connected with {0}:{1}'.format(addr[0], addr[1]))

        process = Process(target=handle_request, args=(conn,))
        process.start()

    socket_descr.close()


start()
