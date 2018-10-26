import collections
import itertools
import re

import ws.http.structs
import ws.utils
from ws.config import config
from ws.err import *
from ws.logs import error_log

MAX_HTTP_META_LEN = config.getint('http', 'max_http_meta_len')
ALLOWED_HTTP_METHODS = frozenset({
    'HEAD',
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'CONNECT',
    'OPTIONS',
    'TRACE'
})


class ParserException(ServerException):
    default_msg = 'Failed to parse request due to bad syntax.'
    default_code = 'PARSER_BAD_SYNTAX'

    def __init__(self, msg=default_msg, code=default_code):
        super().__init__(msg=msg, code=code)


class SpyIterator:
    def __init__(self, iterable):
        self.it = iter(iterable)
        self.peeked = []
        self.iterated_count = 0

    def peek(self, n=1, entire_substring=False):
        for k in range(len(self.peeked), n):
            next_ = next(self.it)
            self.peeked.append(next_)

        if entire_substring:
            return bytes(self.peeked[:n])
        else:
            return self.peeked[n - 1]

    def skip(self, n=1):
        return bytes(next(self) for _ in range(n))

    def __iter__(self):
        return self

    def __next__(self):
        if self.peeked:
            return self.peeked.pop(0)
        else:
            value = next(self.it)
            self.iterated_count += 1

            return value


def parse(client_socket):
    error_log.debug3('Parsing request from socket %s', client_socket.fileno())
    lines = []
    line = bytearray()

    for count, byte in enumerate(client_socket):
        line.append(byte)

        if line[-2:] == b'\r\n':
            del line[-1]
            del line[-1]

            if line == b'':
                break
            else:
                lines.append(line)
                line = bytearray()
        elif count > MAX_HTTP_META_LEN:
            raise ParserException(code='PARSER_REQUEST_TOO_LONG')

    error_log.debug3('Parsed lines %s', lines)

    try:
        request_line = parse_request_line(lines[0])
        error_log.debug2('Parsed request line %s', request_line)
        headers = parse_headers(lines[1:])
    except UnicodeDecodeError as err:
        raise ParserException(code='BAD_ENCODING') from err

    error_log.debug2('headers is %r with type %r', headers, type(headers))

    try:
        cl = int(headers.get('Content-Length', 0))
    except ValueError as e:
        raise ParserException(code='BAD_CONTENT_LENGTH') from e

    error_log.debug2('Deferring parsing of body to later.')
    body = (next(client_socket) for _ in range(cl))

    return ws.http.structs.HTTPRequest(
        request_line=request_line,
        headers=headers,
        body=body
    )


HTTP_VERSION_REGEX = re.compile(b'HTTP/(\\d\\.\\d)')


def parse_request_line(line, *, methods=ALLOWED_HTTP_METHODS):
    error_log.debug3('Parsing request line...')
    parts = line.split(b' ')

    if len(parts) != 3:
        raise ParserException(code='PARSER_BAD_REQUEST_LINE')

    method, request_target, http_version = parts
    method = method.decode('ascii')

    if method not in methods:
        raise ParserException(code='PARSER_UNKNOWN_METHOD')

    error_log.debug2('Parsed method %r', method)

    uri = parse_request_target(request_target)
    error_log.debug2('Parsed uri %r', uri)

    if not HTTP_VERSION_REGEX.match(http_version):
        raise ParserException(code='PARSER_BAD_HTTP_VERSION')

    http_version = http_version.decode('ascii')

    return ws.http.structs.HTTPRequestLine(method=method,
                                           request_target=uri,
                                           http_version=http_version)


def parse_request_target(iterable):
    string = bytes(iterable).decode('ascii')
    if string[0] == '/':
        # origin form
        path, query = parse_path(string)
        return ws.http.structs.URI(
            protocol=None,
            host=None,
            port=None,
            path=path,
            query=query,
        )
    elif string.startswith('http://') or string.startswith('https://'):
        # absolute-form
        protocol, *rest = string.split('://')

        if len(rest) != 1:
            raise ParserException(code='PARSER_BAD_ABSOLUTE_FORM_URI')

        parts = rest[0].split('/')

        if len(parts) <= 1:
            raise ParserException(code='PARSER_MISSING_AUTHORITY')

        user_info, host, port = parse_authority(parts[0])

        absolute_path = '/' + '/'.join(parts[1:])
        path, query = parse_path(absolute_path)

        return ws.http.structs.URI(
            protocol=protocol,
            host=host,
            port=port,
            path=path,
            query=query
        )
    elif string == '*':
        # asterisk form
        raise NotImplementedError()
    else:
        # authority form
        user_info, host, port = parse_authority(string)

        return ws.http.structs.URI(
            protocol=None,
            host=host,
            port=port,
            path=None,
            query=None
        )


AUTHORITY_REGEX = re.compile(r'([^@:]*@)?([^@:]+)(:\d*)?')


def parse_authority(authority):
    matched = AUTHORITY_REGEX.match(authority)

    if not matched:
        raise ParserException(code='PARSER_INVALID_AUTHORITY')

    user_info_, host_, port_ = matched.groups()
    user_info_ = user_info_[:-1] if user_info_ else None
    port_ = port_[1:] if port_ else None

    return user_info_, host_, port_


def parse_path(full_path):
    parts_ = full_path.split('?')
    if len(parts_) == 1:
        return parts_[0], None
    else:
        return parts_[0], '?'.join(parts_[1:])


def parse_headers(lines):
    """ Parses HTTP headers from an iterable into a dictionary.

    NOTE: Does not parse indented multi-line headers
    """
    headers = {}
    for line in lines:
        field, _, value = line.partition(b':')
        if not value:
            raise ParserException(code='PARSER_BAD_HEADER')

        field = field.decode('ascii').strip()
        headers[field] = value.lstrip()
        error_log.debug3('Parsed header field %s with value %r', field, value)

    return headers


@ws.utils.depreciated(error_log)
def take_until_depreciated(characters, spy_iter, take_max=None):
    assert isinstance(characters, collections.Iterable)
    assert isinstance(spy_iter, SpyIterator)
    assert not take_max or isinstance(take_max, int)

    for c in itertools.count():
        if take_max and c >= take_max:
            raise RuntimeError('Iteration reached take_max={}'.format(take_max))

        reached = all(spy_iter.peek(len(s), entire_substring=True) == s
                      for s in characters)
        if reached:
            break

        yield next(spy_iter)
