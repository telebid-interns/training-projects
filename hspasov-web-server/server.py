import os
import socket
import traceback

print(os.getpid())

# TODO make config
RECV_BUFFER = 1024
REQ_MSG_LIMIT = 8192
BACKLOG = 1
HOST = 'localhost'
PORT = 8080
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
    def __init__(self, msg=''):
        super().__init__(msg)
        log(msg)
        log(traceback.print_stack())


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


def parse_req_msg(msg):
    assert_app(type(msg) == bytes)

    msg_parts = msg.split(b'\r\n\r\n')

    assert_peer(len(msg_parts) == 2, 'Invalid request')

    request_line_and_headers = msg_parts[0].split(b'\r\n')

    request_line = request_line_and_headers[0]
    req_line_tokens = request_line.split(b' ')

    assert_peer(len(req_line_tokens) == 3, 'Invalid request')

    parsed_req_line = {
        'method': req_line_tokens[0],
        'req_target': req_line_tokens[1],
        'http_version': req_line_tokens[2],
    }

    headers = {}

    for header_field in request_line_and_headers[1:]:
        header_field_split = header_field.split(b':', 1)

        assert_peer(
            len(header_field_split[0]) == len(header_field_split[0].strip()),
            'Invalid request'
        )

        field_name = header_field_split[0]
        field_value = header_field_split[1].strip()

        headers[field_name] = field_value

    body = msg_parts[1]

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
            data = conn.recv(RECV_BUFFER) # TODO may throw OSError
            msg_received += data

            if len(data) <= 0:
                return

            if msg_received.find(b'\r\n\r\n') != -1:
                break
        else:
            # TODO msg too long
            pass

        request_data = parse_req_msg(msg_received) # TODO may throw PeerError

        print('Request data:')
        print(request_data)

        file_path = os.path.realpath(
            os.path.join(ROOT_DIR, request_data['req_line']['req_target'])
        )

        if ROOT_DIR not in file_path:
            pass
            # TODO no access

        with open(file_path, 'rb') as content_file: # TODO may throw OSError
            content = content_file.read() # TODO may throw OSError
            response = build_res_msg(b'200', content)

        conn.sendall(response) # TODO may throw OSError
    except FileNotFoundError as e:
        print('file not found')
        print(e)
        response = build_res_msg(b'404')

        conn.sendall(response) # TODO may throw OSError
    except OSError:
        pass
        # TODO implement
    finally:
        conn.shutdown()


def start():
    socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    try:
        socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        socket_obj.bind((HOST, PORT))
        socket_obj.listen(BACKLOG)

        while True:
            try:
                conn, addr = socket_obj.accept()  # TODO may throw OSError
                print('Connected with {0}:{1}'.format(addr[0], addr[1]))

                pid = os.fork()  # TODO may throw OSError

                if pid == 0:  # child process
                    socket_obj.close()
                    handle_request(conn)
                    os._exit()
                conn.close()
            except OSError:
                # TODO implement
                pass
            except PeerError:
                # TODO implement
                pass
            except Exception as error:
                if not isinstance(error, AppError):
                    AppError(error)
    except OSError:
        # TODO implement
        pass
    except Exception as error:
        if not isinstance(error, AppError):
            AppError(error)
    finally:
        socket_obj.close()


if __name__ == '__main__':
    start()
