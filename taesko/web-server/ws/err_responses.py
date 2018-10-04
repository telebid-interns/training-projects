import logging

from ws.err import *
from ws.http.structs import HTTPResponse, HTTPStatusLine, HTTPHeaders

logging.getLogger('error').warning('The module %s is depreciated. Please '
                                   'consider using ws/')
err_handlers = {}


def can_handle_err(err):
    err_type = None
    for err_type in err_handlers:
        if isinstance(err, err_type):
            break

    handlers = err_handlers[err_type]

    return ((not hasattr(err, 'code') and None in handlers) or
            (hasattr(err, 'code') and err.code in handlers))


def handle_err(err, *args, **kwargs):
    assert can_handle_err(err)

    err_type = None
    for err_type in err_handlers:
        if isinstance(err, err_type):
            break

    code = err.code if hasattr(err, 'code') else None

    return err_handlers[err_type][code](err, *args, **kwargs)


def err_handler(err_type, err_code):
    def decorator(func):
        if err_type not in err_handlers:
            err_handlers[err_type] = {}

        assert err_code not in err_handlers[err_type]

        err_handlers[err_type][err_code] = func

    return decorator


def response_factory(status_code):
    def response_builder(err=None):
        return HTTPResponse(
            status_line=HTTPStatusLine(
                http_version='HTTP/1.1',
                status_code=status_code,
                reason_phrase=''
            ),
            headers=HTTPHeaders(),
            body=None
        )

    return response_builder


ok = response_factory(200)
created = response_factory(201)
see_other = response_factory(303)


# noinspection PyUnusedLocal
@err_handler(PeerError, 'PEER_STOPPED_SENDING')
def bad_request(err=None):
    return HTTPResponse(
        status_line=HTTPStatusLine(
            http_version='HTTP/1.1',
            status_code=400,
            reason_phrase=''
        ),
        headers=HTTPHeaders({'Content-Encoding': 'ascii'}),
        body='Did not receive the entirety of the request.'
    )


def forbidden(err=None):
    return HTTPResponse(
        status_line=HTTPStatusLine(
            http_version='HTTP/1.1',
            status_code=403,
            reason_phrase=''
        ),
        headers=HTTPHeaders({'Content-Encoding': 'ascii'}),
        body='You do not have permission to access that directory'
    )


method_not_allowed = response_factory(405)


# noinspection PyUnusedLocal
def not_found(err=None):
    return HTTPResponse(
        status_line=HTTPStatusLine(http_version='HTTP/1.1',
                                   status_code=404,
                                   reason_phrase=''),
        headers=HTTPHeaders({'Content-Encoding': 'ascii'}),
        body='File not found\n'
    )


# noinspection PyUnusedLocal
@err_handler(PeerError, 'RECEIVING_REQUEST_TIMED_OUT')
def request_timed_out(err=None):
    return HTTPResponse(
        status_line=HTTPStatusLine(
            http_version='HTTP/1.1',
            status_code=408,
            reason_phrase=''
        ),
        headers=HTTPHeaders(),
        body='',
    )


length_required = response_factory(411)
payload_too_large = response_factory(413)
uri_too_long = response_factory(414)

internal_server_error = response_factory(500)


# noinspection PyUnusedLocal
def service_unavailable(err=None):
    return HTTPResponse(
        status_line=HTTPStatusLine(
            http_version='HTTP/1.1',
            status_code=503,
            reason_phrase='Service is temporarily down due to overhead.'
        ),
        headers=HTTPHeaders({'Retry-After': 30}),
        body=None,
    )
