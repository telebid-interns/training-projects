import collections


HTTPRequest = collections.namedtuple('HTTPRequest', ['request_line',
                                                     'headers',
                                                     'body',
                                                     'decoded'])
HTTPRequestLine = collections.namedtuple('HTTPStartLine', ['method',
                                                         'request_target',
                                                         'http_version',
                                                         'decoded'])
URI = collections.namedtuple('URI', ['path'])
