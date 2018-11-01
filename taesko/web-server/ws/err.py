class BaseError(Exception):
    def __init__(self, *, msg, code):
        super().__init__(msg)

        self.msg = msg
        self.code = code

    @classmethod
    def assert_(cls, condition, *, msg, code, from_=None):
        if not condition:
            if from_:
                raise cls(msg=msg, code=code) from from_
            else:
                raise cls(msg=msg, code=code)


class PeerError(BaseError):
    pass


class SysError(BaseError):
    pass


class UserError(BaseError):
    pass


class ServerException(Exception):
    def __init__(self, msg, code):
        super().__init__(msg)

        self.msg = msg
        self.code = code


class SignalReceived(ServerException):
    def __init__(self, msg, code, signum):
        super().__init__(msg=msg, code=code)
        self.signum = signum


class ExcHandler:
    def __init__(self):
        self.handlers = {}

    def __call__(self, exc_cls):
        def decorator(func):
            assert exc_cls not in self.handlers

            self.handlers[exc_cls] = func
            return func

        return decorator

    def find_handler(self, exc):
        for cls, handler in self.handlers.items():
            if exc.__class__ == cls:
                return handler

    def can_handle(self, exc):
        return bool(self.find_handler(exc))

    def handle(self, exc):
        return self.find_handler(exc)(exc)


exc_handlers = {}


def exc_handler_depreciated(exc_cls):
    def decorator(func):
        assert exc_cls not in exc_handlers

        exc_handlers[exc_cls] = func
        return func

    return decorator


def handle_exc_depreciated(exc):
    for cls, handler in exc_handlers.items():
        if exc.__class__ == cls:
            return handler(exc)

    return None, False
