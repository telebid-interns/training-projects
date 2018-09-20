class BaseError(Exception):

    @classmethod
    def assert_(cls, condition, *args, **kwargs):
        if not condition:
            cls(*args, **kwargs)

class AppError(BaseError, AssertionError):
    pass

class SystemError(BaseError):
    pass

class PeerError(BaseError):
    pass

class UserError(BaseError):
    pass


assertApp = AppError.assert_
assertSystem = PeerError.assert_
assertPeer = PeerError.assert_
assertUser = PeerError.assert_
