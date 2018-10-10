import logging

error_log = logging.getLogger('error')


class AccessLogger:
    def __init__(self, name):
        self.logger = logging.getLogger(name)

    def log(self, request, response):
        # request might be None if the server ignored the request and replied
        # instantly with 4xx or 5xx code
        req_line = request.request_line if request else ''
        request_headers = getattr(request, 'headers', {})

        self.logger.critical('ACCESSED', extra=dict(
            request_line=req_line,
            request_headers=request_headers,
            response_headers=response.headers,
            status_code=response.status_line.status_code,
            body=response.body
        ))


access_log = AccessLogger('access')
