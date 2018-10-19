import logging
import logging.config
import os
import sys

from ws.config import config

if config.getboolean('profiling', 'logs'):
    PROFILE_LEVEL_NUM = 55
else:
    PROFILE_LEVEL_NUM = 1

DEBUG2_LEVEL_NUM = 7
DEBUG3_LEVEL_NUM = 3

logging.basicConfig(level=logging.INFO)
logging.raiseExceptions = True


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


add_log_level(level=PROFILE_LEVEL_NUM, level_name='PROFILE', add_method=False)
add_log_level(level=DEBUG2_LEVEL_NUM, level_name='DEBUG2')
add_log_level(level=DEBUG3_LEVEL_NUM, level_name='DEBUG3')


class _AccessLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)
        self.logger.propagate = False

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
        self.logger.propagate = False

    def profile(self, *args, **kwargs):
        self.logger.log(PROFILE_LEVEL_NUM, *args, **kwargs)


def setup_log_file(file_path, truncate=True, store_old=True, max_count=5):
    def find_free_path(fp, max_c, count=1):
        if count == max_c:
            return fp
        elif not os.path.exists(fp):
            return fp
        elif not os.path.exists(fp + str(count)):
            return fp + str(count)
        else:
            return find_free_path(fp, max_c, count=count + 1)

    if store_old and os.path.exists(file_path):
        logging.info('Storing old file %s.', file_path)
        os.rename(file_path, find_free_path(file_path, max_count))

    if truncate:
        with open(file_path, mode='w') as f:
            pass

    return file_path


def generic_file_handler(cfg_section):
    return logging.FileHandler(
        setup_log_file(
            file_path=cfg_section['file_name'],
            truncate=cfg_section.getboolean('truncate'),
            store_old=cfg_section.getboolean('store_old')
        ),
        mode='a',
        delay=True
    )


error_log = logging.getLogger('error')
error_log.propagate = False
error_log_stream_formatter = logging.Formatter(
    config.get('error_log', 'stream_format', raw=True)
)
error_log_stream_handler = logging.StreamHandler(sys.stderr)
error_log_stream_handler.setFormatter(error_log_stream_formatter)
error_log_file_formatter = logging.Formatter(
    config.get('error_log', 'file_format', raw=True)
)
error_log_file_handler = generic_file_handler(config['error_log'])
error_log_file_handler.setFormatter(error_log_file_formatter)

access_log = _AccessLogger('access')
access_log_formatter = logging.Formatter(
    config.get('access_log', 'format', raw=True)
)
access_log_stream_handler = logging.StreamHandler(sys.stdout)
access_log_stream_handler.setFormatter(access_log_formatter)
access_log_file_handler = generic_file_handler(config['access_log'])
access_log_file_handler.setFormatter(access_log_formatter)

profile_log = _ProfileLog('profile')
profile_log_formatter = logging.Formatter(
    '%(asctime)s %(message)s'
)
profile_log_stream_handler = logging.StreamHandler()
profile_log_stream_handler.setFormatter(profile_log_formatter)
profile_log_file_handler = generic_file_handler(config['profile_log'])
profile_log_file_handler.setFormatter(profile_log_formatter)


def setup_server_handlers():
    error_log.addHandler(error_log_stream_handler)
    access_log.logger.addHandler(access_log_stream_handler)
    profile_log.logger.addHandler(profile_log_stream_handler)


def setup_worker_handlers():
    for handler in error_log.handlers[:]:
        handler.close()
        error_log.removeHandler(handler)

    error_log.addHandler(error_log_file_handler)
    access_log.logger.addHandler(access_log_file_handler)
    profile_log.logger.addHandler(profile_log_file_handler)


setup_server_handlers()
