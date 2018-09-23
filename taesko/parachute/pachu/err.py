class BaseError(Exception):
    def __init__(self, *, msg=None, code=None, userMsg=None):
        super().__init__(msg)

        self.code = code
        self.userMsg = userMsg
        self.msg = msg

    @classmethod
    def assert_(cls, condition, *args, **kwargs):
        if not condition:
            cls(*args, **kwargs)

class AppError(BaseError, AssertionError):
    def __init__(self, *args,
                 userMsg='An application error occurred.', **kwargs):
        super().__init__(*args, userMsg=userMsg, **kwargs)

class SystemError(BaseError):
    def __init__(self, *args, userMsg='An internal error occurred.', **kwargs):
        super().__init__(*args, userMsg=userMsg, **kwargs)


class PeerError(BaseError):
    def __init__(self, *, msg, code, userMsg=None):
        super().__init__(msg=msg, code=code, userMsg=userMsg)

class UserError(BaseError):
    def __init__(self, *, msg, code, userMsg):
        super().__init__(msg=msg, code=code, userMsg=userMsg)


assertApp = AppError.assert_
assertSystem = PeerError.assert_
assertPeer = PeerError.assert_
assertUser = PeerError.assert_
