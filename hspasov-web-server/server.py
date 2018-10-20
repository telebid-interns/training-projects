import os
import socket
import traceback

print(os.getpid())

# TODO make config
RECV_BUFFER = 1024
REQ_MSG_LIMIT = 8192
BACKLOG = 10
HOST = 'localhost'
PORT = 8080
# ROOT_DIR = (b'/home/hristo/Documents/training-projects' +
#            b'/hspasov-web-server/content')
ROOT_DIR = (b'/media/hspasov/Files/TelebidPro/training-projects' +
            b'/hspasov-web-server/content')


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
        'req_line': parsed_req_line,
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
            data = conn.recv(RECV_BUFFER)
            msg_received += data

            if len(data) <= 0:
                # TODO maybe this is unnecessary, but mind the sendall in
                # the finally block
                print('case 1')
                response = build_res_msg(b'400')
                return

            if msg_received.find(b'\r\n\r\n') != -1:
                break
        else:
            print('cas2 ')
            response = build_res_msg(b'400')
            return

        print('msg received:')
        print(msg_received)
        request_data = parse_req_msg(msg_received)  # TODO may throw PeerError

        print('Request data:')
        print(request_data)

        print(ROOT_DIR)
        print(request_data['req_line']['req_target'])
        print(os.path.join(ROOT_DIR, request_data['req_line']['req_target']))

        file_path = os.path.realpath(
            os.path.join(
                ROOT_DIR,
                *request_data['req_line']['req_target'].split(b'/')[1:])
        )

        print(ROOT_DIR)
        print(file_path)

        if ROOT_DIR not in file_path:
            # TODO check if this is correct error handling
            print('case 3')
            response = build_res_msg(b'400')
            return

        with open(file_path, 'rb') as content_file:
            content = content_file.read()
            response = build_res_msg(b'200', content)

    except PeerError:
        print('case 4')
        response = build_res_msg(b'400')
    except FileNotFoundError:
        response = build_res_msg(b'404')
    except OSError:
        response = build_res_msg(b'503')
    except Exception as error:
        print('error 500!')
        print(error)
        print(dir(error))
        print(error.__traceback__)
        print(error.__cause__)
        print(type(error))
        print(error.with_traceback())
        response = build_res_msg(b'500')
    finally:
        conn.sendall(response)  # TODO ASK how to handle when throws OSError
        conn.shutdown(socket.SHUT_RDWR)


def start():
    socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    try:
        socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        socket_obj.bind((HOST, PORT))
        socket_obj.listen(BACKLOG)

        while True:
            try:
                print(socket_obj)
                conn, addr = socket_obj.accept()
                print('Connected with {0}:{1}'.format(addr[0], addr[1]))

                pid = os.fork()

                if pid == 0:  # child process
                    socket_obj.close()
                    handle_request(conn)
            except OSError:
                # TODO ask what to do in this case
                continue
            except Exception as error:
                if not isinstance(error, AppError):
                    AppError(error.with_traceback())
            finally:
                conn.close()  # TODO ask can this fail?
                if pid == 0:
                    # TODO maybe status code should not always be EX_OK
                    os._exit(os.EX_OK)
    except OSError:
        # TODO check correct error handling in this case
        return
    except Exception as error:
        if not isinstance(error, AppError):
            AppError(error.with_traceback())
    finally:
        socket_obj.close()


if __name__ == '__main__':
    start()
