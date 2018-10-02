from ws.err import *
from ws.http.structs import HTTPResponse, HTTPStatusLine, HTTPHeaders

err_handlers = {}


def can_handle_err(err):
    err_type = None
    for err_type in err_handlers:
        if isinstance(err, err_type):
            break

    return (err_type and
            hasattr(err, 'code') and
            err.code in err_handlers[err_type])


def handle_err(err, *args, **kwargs):
    assert can_handle_err(err)

    err_type = None
    for err_type in err_handlers:
        if isinstance(err, err_type):
            break

    return err_handlers[err_type][err.code](err, *args, **kwargs)


def err_handler(err_type, err_code):
    def decorator(func):
        if err_type not in err_handlers:
            err_handlers[err_type] = {}

        assert err_code not in err_handlers[err_type]

        err_handlers[err_type][err_code] = func

    return decorator


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
