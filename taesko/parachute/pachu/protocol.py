import abc
import collections
import logging

import pachu.validation
from pachu.err import assertPeer, PeerError


class BaseProtocol:
    name = None
    format = None

    @abc.abstractmethod
    def normalize(self, inplace=True):
        raise NotImplementedError()

    @abc.abstractmethod
    def validate(self):
        raise NotImplementedError()


class JSONRPC(BaseProtocol):
    name = 'jsonrpc'
    format = 'json'

    def __init__(self, body):
        self.body = body

    def validate(self):
        return pachu.validation.validate_request_through_protocol(self.body, self.name)

    @property
    def method(self):
        return self.body['method']

    @property
    def params(self):
        return self.body['parameters']

    def normalize(self, inplace=True):
        return self.body


class YAMLRPC(BaseProtocol):
    name = 'yamlrpc'
    format = 'yaml'

    def __init__(self, body):
        self.body = body

    def validate(self):
        return pachu.validation.validate_request_through_protocol(self.body, self.name)

    @property
    def method(self):
        return self.body['action']

    @property
    def params(self):
        return self.body['parameters']

    def normalize(self, inplace=True):
        if inplace:
            self.body['method'] = self.body['action']
            self.body['params'] = self.body['parameters']
        else:
            raise NotImplementedError()

        return self.body


def normalize_request(body, content_type, query_param):
    assert isinstance(content_type, str)
    assert isinstance(query_param, str)

    assertPeer(content_type or query_param and not content_type == query_param,
               msg='Specifying differing content-type and format query parameter is not allowed',
               code='API_DIFFERENT_FORMATS')

    format_ = content_type or query_param

    try:
        protocol_cls = next(cls for cls in BaseProtocol.__subclasses__() if cls.format == format_)
    except StopIteration:
        raise PeerError(msg='Unsupported format {}'.format(format_), code='API_UNSUPPORTED_FORMAT')

    protocol = protocol_cls(body)
    protocol.validate()

    return protocol.normalize()
