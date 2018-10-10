import collections
import itertools
import logging
import re

import ws.http.structs
from ws.config import config
from ws.err import *

error_log = logging.getLogger('error')


class ParserError(PeerError):
    default_msg = 'Failed to parse request due to bad syntax.'
    default_code = 'PARSER_BAD_SYNTAX'

    def __init__(self, msg=default_msg, code=default_code):
        super().__init__(msg=msg, code=code)

    def assert_(cls, condition, *, msg=default_msg, code=default_code,
                from_=None):
        super().assert_(condition, msg=msg, code=code, from_=from_)


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


def parse(message_iter, lazy=False):
    assert isinstance(message_iter, SpyIterator)
    assert isinstance(lazy, bool)

    request_line = parse_request_line(message_iter)
    headers = parse_headers(message_iter)
    error_log.debug('headers is %r with type %r', headers, type(headers))

    try:
        cl = int(headers.get('Content-Length', 0))
    except ValueError as e:
        raise ParserError(code='BAD_CONTENT_LENGTH') from e

    if lazy:
        body = parse_body(message_iter, cl)
        error_log.debug('Received body. %s', body)
    else:
        body = parse_body_lazily(message_iter, cl)
        error_log.debug('Deferring parsing of body to later.')

    return ws.http.structs.HTTPRequest(
        request_line=request_line,
        headers=headers,
        body=body
    )


def parse_request_line(it, *,
                       methods=frozenset({
                           'HEAD',
                           'GET',
                           'POST',
                           'PUT',
                           'DELETE',
                           'CONNECT',
                           'OPTIONS',
                           'TRACE'
                       }),
                       max_uri_len=config.getint('http', 'max_uri_len')):
    max_request_len = (max_uri_len +
                       max(map(len, methods)) +
                       len('HTTP/1.1'))
    assert isinstance(it, SpyIterator)

    try:
        line = bytes(take_until((b'\r\n',), it,
                                take_max=max_request_len))
    except RuntimeError as e:
        raise ParserError(code='PARSER_LONG_REQUEST_LINE') from e

    it.skip(2)  # advance through \r\n

    parts = line.split(b' ')

    if len(parts) < 3:
        raise ParserError(code='PARSER_BAD_REQUEST_LINE')

    method, request_target, http_version = parts
    method = method.decode('ascii')

    if method not in methods:
        raise ParserError(code='PARSER_UNKNOWN_METHOD')

    error_log.debug('Parsed method %r', method)

    uri = parse_request_target(request_target)
    error_log.debug('Parsed uri %r', uri)

    if not re.match(b'HTTP/(\\d\\.\\d)', http_version):
        raise ParserError(code='PARSER_BAD_HTTP_VERSION')

    http_version = http_version.decode('ascii')

    return ws.http.structs.HTTPRequestLine(method=method,
                                           request_target=uri,
                                           http_version=http_version)


def parse_request_target(iterable):
    string = bytes(iterable).decode('ascii')

    def parse_authority(authority):
        matched = re.match(r'([^@:]*@)?([^@:]+)(:\d*)?', authority)

        if not matched:
            raise ParserError(code='PARSER_INVALID_AUTHORITY')

        user_info_, host_, port_ = matched.groups()
        user_info_ = user_info_[:-1] if user_info_ else None
        port_ = port_[1:] if port_ else None

        return user_info_, host_, port_

    def parse_path(full_path):
        parts_ = full_path.split('?')
        if len(parts_) == 1:
            return parts_[0], None
        else:
            # TODO is '?' allowed more than once ?
            return parts_[0], parts_[1:]

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
    elif re.match(r'^\w+://', string):
        # absolute-form
        protocol, *rest = string.split('://')

        if len(rest) != 1:
            raise ParserError(code='PARSER_BAD_ABSOLUTE_FORM_URI')

        parts = rest[0].split('/')

        if len(parts) <= 1:
            raise ParserError(code='PARSER_MISSING_AUTHORITY')

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


def parse_headers(message_iterable):
    """ Parses HTTP headers from an iterable into a dictionary.

    NOTE: Does not parse indented multi-line headers
    """
    assert isinstance(message_iterable, SpyIterator)

    headers = {}

    try:
        headers_part = bytes(take_until(
            (b'\r\n\r\n',),
            message_iterable,
            take_max=config.getint('http', 'max_headers_len')
        ))
    except RuntimeError as e:
        raise ParserError(code='PARSER_HEADERS_TOO_LONG') from e

    for line in headers_part.split(b'\r\n'):
        sep_index = line.find(b':')

        if sep_index == -1:
            raise ParserError(code='PARSER_BAD_HEADER')

        # TODO research if this never fails ?
        field = line[:sep_index].decode('ascii')
        value = line[sep_index + 1:]
        headers[field] = value
        error_log.debug('Parsed header field %s with value %r', field, value)

    return headers


def parse_body(iterator, content_len):
    assert isinstance(iterator, SpyIterator)
    assert isinstance(content_len, int)

    parts = []

    # because iterator might be iteration over a wrapper around socket.recv()
    # calling next() on it might hang indefinitely.
    if content_len == 0:
        return b''

    for _ in range(content_len):
        parts.append(next(iterator))

    return bytes(parts)


def parse_body_lazily(iterator, content_len):
    assert isinstance(iterator, SpyIterator)
    assert isinstance(content_len, int)

    # because iterator might be iteration over a wrapper around socket.recv()
    # calling next() on it might hang indefinitely.
    if content_len == 0:
        yield b''
        return

    for _ in range(content_len):
        yield next(iterator)


def take_until(characters, spy_iter, take_max=None):
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
