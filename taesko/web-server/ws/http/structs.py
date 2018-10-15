import collections

import ws.utils
from ws.err import *
from ws.logs import error_log

HTTPRequest = collections.namedtuple('HTTPRequest', ['request_line',
                                                     'headers',
                                                     'body'])


class HTTPRequestLine(collections.namedtuple('HTTPStartLine',
                                             ['method',
                                              'request_target',
                                              'http_version'])):
    def __str__(self):
        return ' '.join(map(str, self))

    def __bytes__(self):
        return str(self).encode('ascii')


class URI(collections.namedtuple('URI', ['protocol', 'host', 'port',
                                         'path', 'query'])):
    @property
    def is_in_origin_form(self):
        return not self.protocol and not self.host and self.path

    @property
    def is_in_absolute_form(self):
        return bool(self.protocol)

    @property
    def is_in_authority_form(self):
        return not self.protocol and self.host

    @property
    def is_in_asterisk_form(self):
        return not self.protocol and not self.host and not self.path

    def __str__(self):
        query_part = '?' + self.query if self.query else ''
        port_part = ':' + self.port if self.port else ''
        templates = {
            '{path}{query_part}': self.is_in_origin_form,
            '{protocol}://{host}{port_part}{path}{query_part}':
                self.is_in_absolute_form,
            '{host}{port_part}': self.is_in_authority_form,
            '*': self.is_in_asterisk_form
        }

        for template, is_right in templates.items():
            if is_right:
                return template.format(**locals(), **self._asdict())

    def __bytes__(self):
        return str(self).encode('ascii')


class HTTPResponse(collections.namedtuple('HTTPResponse', ['status_line',
                                                           'headers',
                                                           'body'])):
    def __iter__(self):
        yield from bytes(self.status_line)
        yield from b'\r\n'
        yield from bytes(self.headers)
        yield from b'\r\n\r\n'
        yield from self.body

    def iter_chunks(self, chunk_size=4096):
        buf = bytearray()
        for b in self:
            buf.append(b)

            if len(buf) == chunk_size:
                yield buf
                buf = bytearray()

        if len(buf) != 0:
            yield buf

    @ws.utils.depreciated
    def send_depreciated(self, sock):
        msg = bytes(self)
        total_sent = 0

        while total_sent < len(msg):
            sent = sock.send(msg[total_sent:])

            if sent == 0:
                raise PeerError(msg='Peer broke socket connection while server '
                                    'was sending.',
                                code='RESPONSE_SEND_BROKEN_SOCKET')

            total_sent += sent

    @ws.utils.depreciated
    def __bytes__(self):
        error_log.warning('Calling depreciated method __bytes__ '
                          'of HTTPResponse')

        if self.body:
            body = '{self.body}'.format(self=self)
            encoded_body = body.encode(self.headers['Content-Encoding'])
        else:
            encoded_body = b''

        assert ('Content-Length' not in self.headers or
                self.headers['Content-Length'] == len(encoded_body))

        self.headers['Content-Length'] = len(encoded_body)
        msg = '{self.status_line}\r\n{self.headers}\r\n\r\n'.format(self=self)
        msg = msg.encode('ascii')
        msg += encoded_body

        return msg


class HTTPStatusLine(
    collections.namedtuple('HTTPStatusLine', ['http_version',
                                              'status_code',
                                              'reason_phrase'])
):
    def __bytes__(self):
        return str(self).encode('ascii')

    def __str__(self):
        template = '{self.http_version} {self.status_code} {self.reason_phrase}'
        return template.format(self=self)


class HTTPHeaders(collections.UserDict):
    def __bytes__(self):
        return str(self).encode('ascii')

    def __str__(self):
        lines = ('{}:{}'.format(field, value) for field, value in self.items())
        return '\r\n'.join(lines)
