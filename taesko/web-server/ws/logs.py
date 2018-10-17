import logging
import logging.config

from ws.config import config

logging.basicConfig(level=logging.INFO)
logging.config.fileConfig(config['logging']['config_file'])
logging.raiseExceptions = False


error_log = logging.getLogger('error')


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


access_log = _AccessLogger('access')
