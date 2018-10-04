import logging

error_log = logging.getLogger('error')


class AccessLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)

    def log(self, request, response):
        # request might be None if the server ignored the request and replied
        # instantly with 4xx or 5xx code
        req_line = request.request_line if request else ''

        self.logger.critical('ACCESSED', extra=dict(
            request_line=req_line,
            headers=response.headers,
            status_code=response.status_line.status_code
        ))


access_log = AccessLogger('access')
