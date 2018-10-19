import logging
import logging.config

from ws.config import config

if config.getboolean('profiling', 'logs'):
    PROFILE_LEVEL_NUM = 45
else:
    PROFILE_LEVEL_NUM = 1

DEBUG2_LEVEL_NUM = 7
DEBUG3_LEVEL_NUM = 3


def add_log_level(
        level, level_name, method_name=None,
        add_method=True, add_to_module=True):
    assert level > 0

    logging.addLevelName(level=level, levelName=level_name)

    if add_to_module:
        setattr(logging, level_name, level)
    if add_method:
        method_name = method_name or level_name.lower()

        def log_custom_level(self, *args, **kwargs):
            # self is a logging.Logger instance
            if self.isEnabledFor(level):
                self.log(level, *args, **kwargs)

        log_custom_level.__name__ = method_name
        setattr(logging.Logger, method_name, log_custom_level)


logging.PROFILE = PROFILE_LEVEL_NUM
add_log_level(level=PROFILE_LEVEL_NUM, level_name='PROFILE', add_method=False)
add_log_level(level=DEBUG2_LEVEL_NUM, level_name='DEBUG2')
add_log_level(level=DEBUG3_LEVEL_NUM, level_name='DEBUG3')

logging.basicConfig(level=logging.INFO)
logging.config.fileConfig(config['logging']['config_file'])
logging.raiseExceptions = True


class _AccessLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)

    def log(self, *, request, response, **kwargs):
        # request might be None if the server ignored the request and replied
        # instantly with 4xx or 5xx code
        req_line = request.request_line if request else ''
        request_headers = getattr(request, 'headers', {})

        self.logger.critical('ACCESSED', extra=dict(
            request_line=req_line,
            request_headers=request_headers,
            response_headers=response.headers,
            status_code=response.status_line.status_code,
            body=response.body,
            **kwargs
        ))


class _ProfileLog:
    def __init__(self, name):
        self.logger = logging.getLogger(name)

    def profile(self, *args, **kwargs):
        self.logger.log(PROFILE_LEVEL_NUM, *args, **kwargs)


access_log = _AccessLogger('access')
error_log = logging.getLogger('error')
profile_log = _ProfileLog('profile')
