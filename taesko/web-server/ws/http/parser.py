import collections
import itertools
import logging
import re

import ws.http.request
from ws.config import config
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


def parse(iterable):
    assert isinstance(iterable, collections.Iterable)

    message_iter = SpyIterator(iterable)
    request_line = parse_request_line(message_iter)
    headers = parse_headers(message_iter)
    logger.debug('headers is %r with type %r', headers, type(headers))
    body = parse_body(message_iter, headers.get('Content-Length', 0))

    return ws.http.request.HTTPRequest(
        request_line=request_line,
        headers=headers,
        body=body,
        decoded=False
    )


def parse_request_line(it, *,
                       methods={
                           b'HEAD',
                           b'GET',
                           b'POST',
                           b'PUT',
                           b'DELETE',
                           b'CONNECT',
                           b'OPTIONS',
                           b'TRACE'
                       },
                       max_uri_len=config.getint('http', 'max_uri_len')):
    max_request_len = (max_uri_len +
                       max(map(len, methods)) +
                       len('HTTP/1.1'))
    assert isinstance(it, SpyIterator)

    try:
        line = bytes(take_until((b'\r\n',), it,
                                take_max=max_request_len))
    except RuntimeError as e:
        err = PeerError(msg='Request line is too long',
                        code='PARSER_LONG_REQUEST_LINE')
        raise err from e

    it.skip(2)  # advance through \r\n

    parts = line.split(b' ')
    assert_peer(len(parts) >= 3,
                msg='Request line does not have enough parts',
                code='PARSER_BAD_REQUEST_LINE')

    method, request_target, http_version = parts

    assert_peer(method in methods,
                msg='Unknown HTTP method {method}'.format(method=method),
                code='PARSER_UNKNOWN_METHOD')
    logger.debug('Parsed method %r', method)

    uri = parse_uri(request_target)
    logger.debug('Parsed uri %r', uri)

    matched = re.match(b'HTTP/(\\d\\.\\d)', http_version)
    assert_peer(matched,
                msg='Incorrect HTTP-version.'
                    'Got {}.'.format(http_version),
                code='PARSER_BAD_HTTP_VERSION')
    version = matched.group(1)
    logger.debug('Parsed version %r', version)

    return ws.http.request.HTTPRequestLine(method=method,
                                           request_target=uri,
                                           http_version=version,
                                           decoded=False)


def parse_uri(iterable):
    return ws.http.request.URI(bytes(iterable))


def parse_headers(message_iterable):
    """ Parses HTTP headers from an iterable into a dictionary.

    NOTE: Does not parse indented multi-line headers
    """
    assert isinstance(message_iterable, SpyIterator)

    headers = {}

    while True:
        line = bytes(take_until((b'\r\n',), message_iterable))
        skipped = message_iterable.skip(2)

        assert_peer(skipped == b'\r\n',
                    msg='Invalid header line {}'.format(line),
                    code='PARSER_BAD_HEADER_LINE')

        if line == b'':
            break

        sep_index = line.find(b':')
        field = line[:sep_index]
        value = line[sep_index + 1:]
        headers[field] = value
        logger.debug('Parsed header field %s with value %r', field, value)

    return headers


def parse_body(iterator, content_len):
    assert isinstance(iterator, SpyIterator)
    assert isinstance(content_len, int)

    parts = []

    # because iterator might be iteration over a wrapper around socket.recv()
    # calling next() on it might hang indefinitely.
    if content_len == 0:
        return b''

    for count, b in enumerate(iterator):
        if count + 1 == content_len:
            break

        parts.append(b)

    return bytes(parts)


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
