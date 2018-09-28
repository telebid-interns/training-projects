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


class AppError(BaseError):
    default_msg='An internal server error occurred'

    def __init__(self, *, msg=default_msg, code=None):
        super().__init__(msg=msg, code=code)

    @classmethod
    def assert_(cls, condition, *, msg=default_msg, code=None):
        super().assert_(condition, msg=msg, code=code)


assert_peer = PeerError.assert_
assert_sys = PeerError.assert_
assert_app = AppError.assert_
