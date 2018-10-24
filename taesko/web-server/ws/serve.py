import collections
import io
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


def is_static_route(route):
    static_route = config.get('routes', 'static', fallback=None)

    if not static_route:
        error_log.debug2('Static route is not set.')
        return False

    static_route = ws.http.utils.normalized_route(static_route)
    route = ws.http.utils.normalized_route(route)
    return route.startswith(static_route)


def is_status_route(route):
    status_route = config.get('routes', 'status', fallback=None)

    if not status_route:
        error_log.debug2('Status route is not set.')
        return False

    status_route = ws.http.utils.normalized_route(status_route)
    route = ws.http.utils.normalized_route(route)
    return status_route == route


FORMAT_FIELD_REGEX = re.compile('%\((\w*)\)\w')


def status():
    # for pos, part in enumerate(config['access_log']['format'].split()):
    #     match = FORMAT_FIELD_REGEX.match(part)
    #     if match:
    #         field = match.group(1)
    #         fields_format[pos + offset] = field
    #         if field == 'asctime':
    #             offset += 1
    #         elif field == 'request_line':
    #             offset += 2
    stats = {}
    fields = {
        7: 'ru_utime',
        8: 'ru_stime',
        9: 'ru_maxrss',
        10: 'response_time',
        11: 'parse_time'
    }
    line_count = -1
    with open(config['access_log']['file_name'], mode='r') as f:
        for line_count, line in enumerate(f):
            for pos, part in enumerate(line.split()):
                if pos not in fields:
                    continue
                fn = fields[pos]
                avg = 'avg_{}'.format(fn)
                max_ = 'max_{}'.format(fn)
                try:
                    val = float(part)
                except ValueError:
                    continue
                if avg not in stats:
                    stats[avg] = {'val': 0, 'count': 0}
                stats[avg]['val'] += val
                stats[avg]['count'] += 1
                stats[max_] = max(val, stats.get(max_, 0))

    lines = []

    for stat, entry in stats.items():
        if stat.startswith('max_'):
            val = entry
        else:
            val = entry['val'] / entry['count']

        lines.append('{stat}={val}'.format(stat=stat, val=val))

    lines.append('served_requests={}\n'.format(line_count + 1))
    lines.sort(key=lambda s: s.strip('max').strip('avg'))
    body = b'\n'.join(l.encode('ascii') for l in lines)
    ib = io.BytesIO()
    ib.write(body)
    ib.seek(0)

    return ws.http.utils.build_response(
        200, body=ib, headers={'Content-Length': len(body),
                               'Content-Type': 'text/html'}
    )
