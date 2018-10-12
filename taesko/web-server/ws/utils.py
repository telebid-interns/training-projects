# TODO error log format for depreciated functions should be consistent
def depreciated(log):
    def decorator(func):
        def wrapped(*args, **kwargs):
            log.warning('Calling depreciated function {}.'
                        .format(func.__name__))
            return wrapped(*args, **kwargs)

        return wrapped

    return decorator
