from ws.err import *
from ws.http.structs import HTTPResponse, HTTPStatusLine, HTTPHeaders
from ws.config import config


def build_response(status_code, *, body=None, reason_phrase='', headers=None,
                   version='HTTP/1.1'):
    status_line = HTTPStatusLine(
        http_version=version,
        status_code=status_code,
        reason_phrase=reason_phrase
    )
    headers = HTTPHeaders(headers or {})

    if body:
        assert 'Content-Encoding' in headers

    return HTTPResponse(
        status_line=status_line,
        headers=headers,
        body=body
    )


ok = build_response(200)
created = build_response(201)
see_other = build_response(303)

bad_request = build_response(400)
forbidden = build_response(403)
not_found = build_response(404)
method_not_allowed = build_response(405)
request_timeout = build_response(408)
length_required = build_response(411)
payload_too_large = build_response(413)
uri_too_long = build_response(414)

internal_server_error = build_response(500)
service_unavailable = HTTPResponse(
    status_line=HTTPStatusLine(
        http_version='HTTP/1.1',
        status_code=503,
        reason_phrase='Service is temporarily down due to overhead.'
    ),
    headers=HTTPHeaders(
        {
            'Retry-After': config.getint('settings', 'process_timeout') * 2
        }
    ),
    body=None,
)

client_err_responses = {
    PeerError: {
        'PEER_STOPPED_SENDING': bad_request,
        'RECEIVING_REQUEST_TIMED_OUT': request_timeout
    },
}
server_err_responses = {
    AssertionError: {
        None: internal_server_error
    }
}


def get_err_response(dct, exc_val):
    assert isinstance(exc_val, Exception)

    if exc_val.__class__ not in dct:
        return None

    code = getattr(exc_val, 'code', None)

    return dct[exc_val.__class__].get(code, None)


def client_err_response(exc_val):
    return get_err_response(client_err_responses, exc_val)


def server_err_response(exc_val):
    return (get_err_response(server_err_responses, exc_val) or
            internal_server_error)
