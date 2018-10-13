import socket
import traceback

RECV_BUFFER = 4096

class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg
        handle_error(self.msg)


class AppError(BaseError):
    def __init__(self):
        super().__init__('')


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

        assert_peer(len(header_field_split[0]) == len(header_field_split[0].strip()), 'Invalid request')

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


def start():
    socket_descr = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    socket_descr.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    socket_descr.bind((host, port))

    socket_descr.listen(1)

    while True:
        conn, addr = socket_descr.accept()
        print('Connected with {0}:{1}'.format(addr[0], addr[1]))

        total_data = conn.recv(RECV_BUFFER)

        print('received:')
        print(total_data.decode())

        request_data = parse_req_msg(total_data.decode())

        print(request_data)

        response = ('HTTP/1.0 200 OK\r\n\r\n' +
        '<html><head><title>Welcome!</title></head>' +
        '<body><h1>Follow the link...</h1>' +
        'All the server needs to do is ' +
        'to deliver the text to the socket. ' +
        'It delivers the HTML code for a link, ' +
        'and the web browser converts it. <br><br><br><br>' +
        '<font size="7"><center> <a href="http://python.about.com/index.html">Click me!</a> </center></font>' +
        '<br><br>The wording of your request was:' +
        '</body></html>')

        conn.sendall(response.encode())
        conn.close()

    socket_descr.close()


start()
