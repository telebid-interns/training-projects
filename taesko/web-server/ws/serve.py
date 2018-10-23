import collections
import os
import re

import ws.http.utils
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

if not STATIC_ROUTE.endswith('/'):
    raise SysError(msg="routes.static must end with a '/'",
                   code='CONFIG_BAD_STATIC_ROUTE')
if not os.path.isdir(STATIC_DIR):
    raise SysError(msg='resources.static_dir field must be a directory',
                   code='CONFIG_BAD_STATIC_DIR')


def file_chunk_gen(fp):
    buf_size = 4096
    with open(fp, mode='rb') as f:
        chunk = f.read(buf_size)
        # temporarily stop gen for exceptions to blow up before
        # content gets yielded
        yield

        while chunk:
            yield chunk
            chunk = f.read(buf_size)


def get_file(route):
    resolved = resolve_route(route,
                             route_prefix=STATIC_ROUTE, dir_prefix=STATIC_DIR)

    if not resolved:
        return ws.http.utils.build_response(404)

    try:
        body_it = file_chunk_gen(resolved)
        # startup the generator to have exceptions blow here.
        next(body_it)
        return HTTPResponse(
            status_line=HTTPStatusLine(http_version='HTTP/1.1',
                                       status_code=200,
                                       reason_phrase=''),
            headers=HTTPHeaders({
                'Content-Length': os.path.getsize(resolved)
            }),
            body=body_it
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


ServerStats = collections.namedtuple(
    'ServerStats', ['avg_worker_time', 'max_worker_time',
                    'avg_response_time', 'max_response_time',
                    'avg_parse_time', 'max_parse_time',
                    'avg_ru_utime', 'max_ru_utime',
                    'avg_ru_stime', 'max_ru_stime',
                    'avg_ru_maxrss', 'max_ru_maxrss',
                    'served_requests']
)


FORMAT_FIELD_REGEX = re.compile('%\((\w*)\)\w')
def status():
    worker_time, max_worker_time = 0, 0
    response_time, max_response_time = 0, 0
    parse_time, max_parse_time = 0, 0
    cpu_time, max_cpu_time = 0, 0
    ram, max_ram = 0, 0
    raw_stats = {}
    fields_format = {}
    offset = 0
    for pos, part in enumerate(config['access_log']['format'].split()):
        match = FORMAT_FIELD_REGEX.match(part)
        if match:
            field = match.group(1)
            fields_format[pos+offset] = field
            if field == 'asctime':
                offset += 1
            elif field == 'request_line':
                offset += 2

    stats = {}
    with open(config['access_log']['file_name'], mode='r') as f:
        for line in f:
            for pos, part in enumerate(line.split()):
                field_name = fields_format[pos]
                avg = 'avg_{}'.format(field_name)
                max_ = 'max_{}'.format(field_name)
                if (avg not in ServerStats._fields or
                    max_ not in ServerStats._fields):
                    continue
                raise NotImplementedError()

