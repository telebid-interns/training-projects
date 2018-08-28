import logging


logger = logging.getLogger(__name__)


class BaseError(Exception):
    def __init__(self, msg, userMsg=None, code=None):
        super().__init__(msg)

        self.msg = msg
        self.userMsg = userMsg
        self.code = code

        logger.exception(self)


    @classmethod
    def assert_(cls, conditon, msg, userMsg=None, code=None):
        if (conditon):
            raise cls(msg, userMsg, code)

class AppError(BaseError, AssertionError):
    pass


class SystemError(BaseError):
    pass


class PeerError(BaseError):
    pass

class UserError(BaseError):
    pass


assertSystem = SystemError.assert_
assertPeer = PeerError.assert_
assertUser = UserError.assert_
