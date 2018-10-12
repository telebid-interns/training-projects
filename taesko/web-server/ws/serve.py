import collections
import errno
import logging
import os

import ws.responses
from ws.config import config
from ws.err import *
from ws.http.structs import HTTPResponse, HTTPStatusLine, HTTPHeaders

error_log = logging.getLogger('error')
STATIC_ROUTE = config['routes']['static']
STATIC_DIR = os.path.abspath(config['resources']['static_dir'])

assert_system(STATIC_ROUTE.endswith('/'),
              msg="routes.static must end with a '/'",
              code='CONFIG_BAD_STATIC_ROUTE')
assert_system(os.path.isdir(STATIC_DIR),
              msg='resources.static_dir field must be a directory',
              code='CONFIG_BAD_STATIC_DIR')


def get_file(route):
    resolved = resolve_route(route,
                             route_prefix=STATIC_ROUTE, dir_prefix=STATIC_DIR)

    if not resolved:
        return ws.responses.not_found

    try:
        # TODO don't open with an encoding.
        with open(resolved, mode='r', encoding='utf-8') as f:
            content = f.read()  # TODO don't read entire file
    except (FileNotFoundError, IsADirectoryError):
        return ws.responses.not_found

    return HTTPResponse(
        status_line=HTTPStatusLine(http_version='HTTP/1.1',
                                   status_code=200,
                                   reason_phrase=''),
        headers=HTTPHeaders({
            'Content-Length': len(content),
            'Content-Encoding': 'ascii'
        }),
        body=content
    )


def resolve_route(route, route_prefix, dir_prefix):
    if not route.startswith(route_prefix):
        return None

    rel_path = route[len(route_prefix):]
    file_path = os.path.join(dir_prefix, rel_path)
    resolved = os.path.abspath(os.path.realpath(file_path))

    # if a symlink get's created after this if statement an exploit is possible
    if not resolved.startswith(dir_prefix):
        return None

    return resolved


def upload_file(route, body_stream, encoding):
    assert isinstance(route, (str, bytes))
    assert isinstance(body_stream, collections.Iterable)

    resolved = resolve_route(route,
                             route_prefix=STATIC_ROUTE, dir_prefix=STATIC_DIR)

    error_log.info('Uploading file to route %s (resolves to %s)',
                   route, resolved)

    if not resolved:
        return ws.responses.forbidden

    if os.path.exists(resolved):
        return ws.responses.see_other

    try:
        with open(resolved, mode='x', encoding='utf-8') as f:
            f.write(bytes(body_stream).decode(encoding))
    except FileExistsError:
        return ws.responses.see_other
    except OSError as err:
        if os.path.exists(resolved):
            os.remove(resolved)

        if err.errno == errno.ENAMETOOLONG:
            return ws.responses.uri_too_long
        elif err.errno == errno.EFBIG:
            return ws.responses.payload_too_large
        else:
            raise

    response = ws.responses.created
    response.headers['Location'] = route

    return response


def delete_file(route):
    assert isinstance(route, (str, bytes))

    resolved = resolve_route(route,
                             route_prefix=STATIC_ROUTE, dir_prefix=STATIC_DIR)

    error_log.info('Deleting file from route %s (resolves to %s).',
                   route, resolved)

    if not resolved:
        return ws.responses.forbidden

    try:
        os.remove(resolved)
    except IsADirectoryError:
        return ws.responses.method_not_allowed
    except FileNotFoundError:
        return ws.responses.not_found

    return ws.responses.ok
