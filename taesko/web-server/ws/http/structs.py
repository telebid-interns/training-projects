import collections

from ws.err import *


HTTPRequest = collections.namedtuple('HTTPRequest', ['request_line',
                                                     'headers',
                                                     'body',
                                                     'decoded'])
HTTPRequestLine = collections.namedtuple('HTTPStartLine', ['method',
                                                           'request_target',
                                                           'http_version'])

URI = collections.namedtuple('URI', ['protocol', 'host', 'port', 'path',
                                     'query'])


class HTTPResponse(
    collections.namedtuple('HTTPResponse', ['status_line',
                                            'headers',
                                            'body'])
):
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
        msg = '{self.status_line}\r\n{self.headers}\r\n\r\n'.format(self=self)
        msg = msg.encode('ascii')

        if self.body:
            body = '{self.body}'.format(self=self)
            msg += body.encode(self.headers['Content-Encoding'])

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
