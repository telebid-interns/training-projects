import os
import pathlib
import collections
import hashlib
import base64
import binascii
import time

import ws.http.utils as hutils
from ws.config import config
from ws.err import *
from ws.logs import error_log


class AuthException(ServerException):
    pass


class InvalidCredentials(AuthException):
    pass


class BasicCredentials(collections.namedtuple('_BasicCredentials',
                                              ['login', 'pw_hash', 'routes'])):
    @classmethod
    def from_line(cls, line):
        assert isinstance(line, str)

        login, pw_hash, rest = line.split(',', 3)
        routes = map(hutils.decode_uri_component, rest.split(':'))
        routes = tuple(hutils.normalized_route(r) for r in routes)

        return cls(login=login, pw_hash=pw_hash, routes=routes)

    @staticmethod
    def hash_login(login, password, encoding='utf-8'):
        salted_pw = password + login[:6]
        ph = hashlib.sha256(salted_pw.encode(encoding)).hexdigest()
        return ph

    @staticmethod
    def serialize_plain_text(login, plain_pw, routes):
        routes_part = ':'.join(map(hutils.encode_uri_component, routes))
        pw_hash = BasicCredentials.hash_login(login=login, password=plain_pw)
        return ','.join([login, pw_hash, routes_part])

    def match_credentials(self, login, password):
        assert isinstance(login, str)
        assert isinstance(password, str)

        ph = self.hash_login(login, password)
        return self.pw_hash == ph


class BasicAuth:
    def __init__(self,
                 credentials_storage=config['settings']['authorization_file'],
                 auth_timeout=config['settings']['auth_timeout']):
        assert isinstance(credentials_storage,
                          (str, bytes, bytearray, pathlib.Path))

        if not os.path.isfile(credentials_storage):
            raise UserError(msg='authorization_file={} is not a valid file path'
                            .format(credentials_storage),
                            code='AUTH_CONFIG_BAD_STORAGE')

        self.credentials_storage = credentials_storage
        self.credentials = {}
        self.required_auth = frozenset()
        self.authorized = {}
        self.auth_timeout = auth_timeout
        self.load_credentials()

    @staticmethod
    def parse_authorized_header(request):
        if 'Authorization' not in request.headers:
            raise AuthException(msg='The Authorization header is required.',
                                code='AUTH_MISSING_AUTH_HEADER')

        auth = request.headers['Authorization']
        try:
            scheme, credentials = auth.split(b' ', 1)
        except ValueError as err:
            raise AuthException(msg='Incorrect Authorization header syntax.',
                                code='AUTH_BAD_AUTH_HEADER') from err

        if scheme != b'Basic':
            error_log.info('User-Agent sent an unknown authorization scheme %s',
                           scheme)
            raise AuthException(msg='Only Basic auth scheme is supported.',
                                code='AUTH_NOT_BASIC')

        try:
            login, pw = base64.b64decode(credentials).decode('utf-8').split(':')
        except (UnicodeDecodeError, binascii.Error, ValueError) as err:
            error_log.debug('Failed to decode and parse basic credentials %s.'
                            'An exception %s occurred',
                            credentials, err)
            raise AuthException(msg='Bad credentials encoding or format.',
                                code='AUTH_BAD_CRED') from err

        return login, pw

    @staticmethod
    def challenges(route):
        return 'Basic realm="{}"'.format(route)

    def load_credentials(self):
        authorized = {}
        credentials = {}
        required_auth = set()

        with open(self.credentials_storage, mode='r', encoding='utf-8') as f:
            for line in f:
                bc = BasicCredentials.from_line(line)
                credentials[bc.login] = bc
                for route in bc.routes:
                    required_auth.add(route)

        self.credentials = credentials
        self.required_auth = frozenset(required_auth)
        self.authorized = authorized

    def register_login(self, login, plain_pw, routes):
        with open(self.credentials_storage, mode='a', encoding='utf-8') as f:
            lines = [BasicCredentials.serialize_plain_text(login=login,
                                                           plain_pw=plain_pw,
                                                           routes=routes)]
            f.writelines(lines)

    def remove_login(self, login):
        with open(self.credentials_storage, mode='r', encoding='utf-8') as f:
            lines = f.read()

        lines = [l for l in lines if not l.startswith(login)]

        with open(self.credentials_storage, mode='w', encoding='utf-8') as f:
            f.writelines(lines)

    def check(self, request, address):
        raw_route = request.request_line.request_target.path
        route = hutils.normalized_route(raw_route)

        if route not in self.required_auth:
            error_log.debug3('route %s does not require auth.', route)
            return True, None
        elif address in self.authorized and route in self.authorized[address]:
            cached_time = self.authorized[address][route]
            if time.time() - cached_time > self.auth_timeout:
                del self.authorized[address][route]
            else:
                error_log.debug('Using cached authorization for '
                                'address %s on route %s',
                                address, route)
                return True, None

        try:
            login, pw = self.parse_authorized_header(request)
        except AuthException:
            return False, hutils.build_response(
                401, headers={'WWW-Authenticate': self.challenges(route)}
            )

        error_log.debug('Validating credentials of address %s on route %s',
                        address, route)

        if self.credentials[login].match_credentials(login, pw):
            address_auths = self.authorized.setdefault(address, {})
            address_auths[route] = time.time()
            return True, None
        else:
            return False, hutils.build_response(403)
