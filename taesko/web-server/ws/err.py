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


assert_peer = PeerError.assert_
assert_system = SysError.assert_
err_handlers = {}


def err_handler(exc_cls):
    def decorator(func):
        assert exc_cls not in err_handlers

        err_handlers[exc_cls] = func
        return func

    return decorator


def handle_err(exc):
    for cls, handler in err_handlers.items():
        if exc.__class__ == cls:
            return handler(exc)

    return None
