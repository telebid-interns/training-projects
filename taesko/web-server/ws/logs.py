import logging
import logging.config
import configparser
import sys

from ws.config import config

if config.getboolean('profiling', 'logs'):
    PROFILE_LEVEL_NUM = 55
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
# logging.config.fileConfig(config['logging']['config_file'])
logging.raiseExceptions = True
logging_config = configparser.ConfigParser(config['logging']['config_file'])


class HandlerBuilder:
    configs = {
        'StreamHandler': {
            'args': {
                'stdout': sys.stdout,
                'stderr': sys.stderr
            }
        }
    }

    def __init__(self, cfg_section):
        self.cfg_section = cfg_section

    @property
    def formatter(self):
        return self.cfg_section['formatter']

    def build_handler(self):

    def build_stream_handler(self):
        assert self.cfg_section['class'] == 'StreamHandler'
        stream = self.configs[self.cfg_section['class']['args']]
        handler = logging.StreamHandler(stream)
        handler.setLevel(self.cfg_section['level'])
        return handler

    def build_file_handler(self):
        assert self.cfg_section['class'] == 'FileHandler'
        filename = self.cfg_section['filename']
        mode = self.cfg_section.get('mode', 'w')
        handler = logging.FileHandler(filename=filename, mode=mode)
        handler.setLevel(self.cfg_section['level'])


class BaseLogger:
    def __init__(self, name):
        self.name = name
        self.logger = logging.getLogger(name)

    def re_open_file_handlers(self):
        for handler in self.logger.handlers:
            handler.close()

        cfg_section = logging_config['logger_{}'.format(self.name)]
        handler_names = cfg_section['handlers'].split(',')

        for hn in handler_names:
            hn = hn.strip()
            handler_cfg = logging_config['handler_{}'.format(hn)]

            handler = logging.
            format_ = handler_cfg['format']


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

    @staticmethod
    def open_handlers():
        pass

    def re_open_file_handlers(self):
        for handler in self.logger.handlers:
            handler.close()
            self.logger.removeHandler(handler)

        for handler in self.open_handlers():
            self.logger.addHandler(handler)

    def profile(self, *args, **kwargs):
        self.logger.log(PROFILE_LEVEL_NUM, *args, **kwargs)


access_log = _AccessLogger('access')
error_log = logging.getLogger('error')
profile_log = _ProfileLog('profile')

logging.disable(logging.CRITICAL)
