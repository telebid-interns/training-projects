import collections

from ws.err import *

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
    def send(self, sock):
        msg = bytes(self)
        total_sent = 0

        while total_sent < len(msg):
            sent = sock.send(msg[total_sent:])
            assert_peer(sent != 0,
                        msg='Peer broke socket connection while server '
                            'was sending.',
                        code='RESPONSE_SEND_BROKEN_SOCKET')
            total_sent += sent

    def __bytes__(self):
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
