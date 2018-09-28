import re
import collections
import logging

from ws.err import *


logger = logging.getLogger('error')


class SpyIterator:
    def __init__(self, iterable):
        self.it = iter(iterable)
        self.peeked = []
        self.iterated_count = 0

    def peek(self, n=1, entire_substring=False):
        for k in range(len(self.peeked), n):
            next_ = next(self.it)
            logger.debug('next_ is %r type is %s', next_, type(next_))
            self.peeked.append(next_)

        if entire_substring:
            return b''.join(self.peeked[:n])
        else:
            return self.peeked[n - 1]

    def __iter__(self):
        return self

    def __next__(self):
        if self.peeked:
            return self.peeked.pop(0)
        else:
            value = next(self.it)
            self.iterated_count += 1

            return value


class HTTPParser:
    def __init__(self):
        self.message_iter = None
        self.start_line = None
        self.headers = None
        self.body = None

    def parse(self, message_iterable):
        assert isinstance(message_iterable, collections.Iterable)

        self.message_iter = SpyIterator(message_iterable)
        self.start_line = HTTPStartLine.from_message_iterator(self.message_iter)
        self.headers = parse_headers(self.message_iter)
        self.body = parse_body(self.message_iter,
                               int(self.headers[b'Content-Length']))


def parse_headers(message_iterable):
    """
    TODO does not parse indented complex headers
    """
    assert isinstance(message_iterable, SpyIterator)

    headers = {}

    while True:
        line = ''.join(take_until(('\r', ), message_iterable))
        assert_peer(message_iterable.peek(2) == '\n',
                    msg='Invalid header line {}'.format(line),
                    code='PARSER_BAD_HEADER_LINE')
        # advance through \r\n
        next(message_iterable)
        next(message_iterable)

        if line == '':
            break

        field, value = line.split(':')
        headers[field] = value

    return headers


def parse_body(iterator, content_length):
    assert isinstance(iterator, SpyIterator)
    assert isinstance(content_length, int)

    parts = []
    while iterator.iterated_count == content_length:
        parts.append(next(iterator))

    return ''.join(parts)


class HTTPStartLine:
    methods = {
        b'HEAD',
        b'GET',
        b'POST',
        b'PUT',
        b'DELETE',
        b'CONNECT',
        b'OPTIONS',
        b'TRACE'
    }
    line_ends = ('\r', '\n')
    space = ' '
    delimiter = (*line_ends, space)

    def __init__(self, method, request_target, http_version):
        self.method = method
        self.request_target = request_target
        self.http_version = http_version

    @classmethod
    def from_message_iterator(cls, it):
        assert isinstance(it, SpyIterator)

        method = b''.join(take_until(cls.delimiter, it))
        assert_peer(method in cls.methods,
                    msg='Unknown HTTP method {method}'.format(method=method),
                    code='PARSER_UNKNOWN_METHOD')

        logger.debug('Parsed method %s', method)

        uri = URI(''.join(take_until(cls.delimiter, it)))
        assert_peer(it.peek(1) not in cls.line_ends,
                    msg='Parsing URI component reached end of line.'
                        'Perhaps HTTP version is missing ?',
                    code='PARSER_BAD_URI')

        logger.debug('Parsed uri', uri)

        version_field = b''.join(take_until(cls.delimiter, it))
        matched = re.match(b'HTTP/(\\d\\.\\d)', version_field)
        assert_peer(matched,
                    msg='Incorrect HTTP-version.'
                        'Got {}.'.format(version_field),
                    code='PARSER_BAD_HTTP_VERSION')
        version = matched.group(1)

        return cls(method=method, request_target=uri, http_version=version)


class URI:
    def __init__(self, string):
        self.path = string


def take_until(characters, spy_iter):
    assert isinstance(characters, collections.Iterable)
    assert isinstance(spy_iter, SpyIterator)

    while True:
        reached = all(spy_iter.peek(len(s), entire_substring=True) == s
                      for s in characters)
        if reached:
            break

        yield next(spy_iter)
