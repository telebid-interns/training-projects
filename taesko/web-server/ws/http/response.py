import collections


class Response:
    def __init__(self, *, status, version='HTTP/1.1', headers, body=None):
        self.status_line = StatusLine(version=version, status=status)
        self.headers = Headers(headers)
        self.body = body

    def __str__(self):
        template = '{self.status_line}\r\n{self.headers}\r\n\r\n'

        if self.body:
            template += '{self.body}'

        return template.format(self=self)

    def __bytes__(self):
        return str(self).encode(self.headers['Content-Type'])


class StatusLine:
    allowed_versions = ('HTTP/1.1', )

    def __init__(self, version, status, reason=''):
        assert version in self.__class__.allowed_versions
        self.version = version
        self.status = status
        self.reason = reason

    def __str__(self):
        return '{self.version} {self.status} {self.reason}'.format(
            self=self
        )


class Headers(collections.UserDict):
    def __str__(self):
        lines = ('{}:{}'.format(field, value) for field, value in self.items())
        return '\r\n'.join(lines)
