import collections
import errno
import os

import ws.http.utils
import ws.responses
from ws.config import config
from ws.err import *
from ws.http.structs import HTTPResponse, HTTPStatusLine, HTTPHeaders
from ws.logs import error_log

STATIC_ROUTE = config['routes']['static']
STATIC_DIR = os.path.realpath(os.path.abspath(
    config['resources']['static_dir']
))

error_log.info('Configured static route is %s. Directory is %s',
               STATIC_ROUTE, STATIC_DIR)

assert_system(STATIC_ROUTE.endswith('/'),
              msg="routes.static must end with a '/'",
              code='CONFIG_BAD_STATIC_ROUTE')
assert_system(os.path.isdir(STATIC_DIR),
              msg='resources.static_dir field must be a directory',
              code='CONFIG_BAD_STATIC_DIR')


def get_file(route):
    def content_iterator(fp):
        def make_iterator():
            buf_size = 4096
            with open(fp, mode='rb') as f:
                chunk = f.read(buf_size)
                # temporarily stop gen for exceptions to blow up before
                # content gets yielded
                yield

                while chunk:
                    yield chunk
                    chunk = f.read(buf_size)

        it = make_iterator()
        # startup the generator to have exceptions blow here.
        next(it)
        return it

    resolved = resolve_route(route,
                             route_prefix=STATIC_ROUTE, dir_prefix=STATIC_DIR)

    if not resolved:
        return ws.http.utils.build_response(404)

    try:
        return HTTPResponse(
            status_line=HTTPStatusLine(http_version='HTTP/1.1',
                                       status_code=200,
                                       reason_phrase=''),
            headers=HTTPHeaders({
                'Content-Length': os.path.getsize(resolved)
            }),
            body=content_iterator(resolved)
        )
    except (FileNotFoundError, IsADirectoryError):
        return ws.http.utils.build_response(404)


def resolve_route(route, route_prefix, dir_prefix):
    if not route.startswith(route_prefix):
        error_log.debug('Route %s does not start with prefix %s',
                        route, route_prefix)
        return None

    rel_path = route[len(route_prefix):]
    file_path = os.path.join(dir_prefix, rel_path)
    resolved = os.path.abspath(os.path.realpath(file_path))

    # if a symlink get's created after this if statement an exploit is possible
    if not resolved.startswith(dir_prefix):
        error_log.debug('Resolved route %s is not inside dir %s',
                        resolved, dir_prefix)
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
