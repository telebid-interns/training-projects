import collections

HTTPRequest = collections.namedtuple('HTTPRequest', ['request_line',
                                                     'headers',
                                                     'body',
                                                     'decoded'])
HTTPRequestLine = collections.namedtuple('HTTPStartLine', ['method',
                                                           'request_target',
                                                           'http_version'])
_URI = collections.namedtuple('URI', ['protocol', 'host', 'port', 'path',
                                      'query'])


class URI(_URI):
    def decoded(self):
        return self
