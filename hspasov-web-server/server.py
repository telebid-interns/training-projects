import errno
import os
import socket
import traceback
import datetime
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
    print('{0}:({1}): {2}'.format(os.getpid(), datetime.datetime.now(), msg))


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


def add_res_meta(status_code, headers={}, body=b''):
    assert_app(type(status_code) == bytes)
    assert_app(type(headers) == dict)
    assert_app(type(body) == bytes)
    assert_app(status_code in response_reason_phrases)

    result = (b'HTTP/1.1 ' + status_code + b' ' +
              response_reason_phrases[status_code])

    for field_name, field_value in headers.items():
        result += (b'\r\n' + field_name + b': ' + field_value)

    result += (b'\r\n\r\n' + body)

    return result


def handle_request(conn):
    msg_received = b''

    recv_timestamps = []

    try:
        while len(msg_received) <= config['req_msg_limit']:
            data = conn.recv(config['recv_buffer'])
            msg_received += data

            recv_timestamps.append(datetime.datetime.now())

            if len(data) <= 0:
                # TODO maybe this is unnecessary, but mind the sendall in
                # the finally block
                log('case 1')
                response = add_res_meta(b'400')
                return

            if msg_received.find(b'\r\n\r\n') != -1:
                #og('Got headers. Recvs:')
                #og(recv_timestamps)
                break
        else:
            log('case2 ')
            response = add_res_meta(b'400')
            return

        request_data = parse_req_msg(msg_received)  # TODO may throw PeerError

        #og('Request data:')
        #og(request_data)

        file_path = os.path.realpath(
            os.path.join(
                config['root_dir'],
                *request_data['req_line']['req_target'].split(b'/')[1:])
        )

        if config['root_dir'] not in file_path:
            # TODO check if this is correct error handling
            log('case 3')
            response = add_res_meta(b'400')
            return

        with open(file_path, mode='rb') as content_file:
            response_packages_sent = 0

            while True:
                content = content_file.read(config['read_buffer'])

                if len(content) <= 0:
                    break
                if response_packages_sent == 0:
                    content_length = os.path.getsize(file_path)

                    headers = {
                        b'Content-Length': bytes(str(content_length), 'utf-8')
                    }
                    response = add_res_meta(b'200', headers, content)
                else:
                    response = content

                response_packages_sent += 1
                conn.sendall(response)

    except PeerError:
        log('case 4')
        response = add_res_meta(b'400')
        conn.sendall(response)
    except FileNotFoundError:
        response = add_res_meta(b'404')
        conn.sendall(response)
    except OSError:
        response = add_res_meta(b'503')
        conn.sendall(response)
    except Exception as error:
        log('error 500!')
        log(error)
        log(dir(error))
        log(error.__traceback__)
        log(error.__cause__)
        log(type(error))
        log(error.with_traceback())
        response = add_res_meta(b'500')
        conn.sendall(response)
    finally:
        conn.shutdown(socket.SHUT_RDWR)


def start():
    socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    try:
        socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        socket_obj.bind((config['host'], config['port']))
        socket_obj.listen(config['backlog'])

        while True:
            try:
                conn, addr = socket_obj.accept()
                log('Connected with {0}:{1}'.format(addr[0], addr[1]))

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
    try:
        with open('./config.json', mode='r') as config_file:
            config_file_content = config_file.read()
            config = json.loads(config_file_content)
            # root dir needs to be bytes so that file path received from http
            # request can be directly concatenated to root dir
            config['root_dir'] = bytes(config['root_dir'], 'utf-8')
            print(config)
        start()
    except OSError as error:
        log(error)
    except json.JSONDecodeError as error:
        log('Error while parsing config file: "{0}"'.format(error))
