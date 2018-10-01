class BaseError(Exception):
    def __init__(self, *, msg, code):
        super().__init__(msg)

        self.msg = msg
        self.code = code

    @classmethod
    def assert_(cls, condition, *, msg, code):
        if not condition:
            raise cls(msg=msg, code=code)


class PeerError(BaseError):
    pass


class SysError(BaseError):
    pass


assert_peer = PeerError.assert_
assert_sys = PeerError.assert_
