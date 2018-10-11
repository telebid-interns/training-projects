import os
import collections
import subprocess

import ws.http.utils
from ws.config import config
from ws.logs import error_log
from ws.err import *

CGI_SCRIPTS_DIR = config['cgi']['scripts_dir']
assert_system(os.path.isdir(CGI_SCRIPTS_DIR),
              msg='In configuration: cgi.scripts_dir is not a directory.',
              code='CGI_CONFIG_NOT_DIR')


class CGIError(BaseError):
    pass


class CGIClientError(CGIError, PeerError):
    pass


class CGIScriptError(CGIError):
    pass


class CGIScript(collections.namedtuple('CGIScript', ['name',
                                                     'route',
                                                     'pass_full_path_info'])):
    @classmethod
    def from_config(cls, script_name):
        section_name = 'cgi_{}'.format(script_name)
        if section_name not in config:
            msg = 'CGI script with name {} is not configured'.format(
                script_name
            )

            raise SysError(msg=msg, code='CGI_CONF_MISSING_SECTION')

        section = config[section_name]

        cgi_script = cls(
            name=script_name,
            route=normalized_route(section['route']),
            pass_full_path_info=section.getboolean('pass_full_path_info')
        )

        if not os.path.exists(cgi_script.script_path):
            msg = 'CGI executable not found at {}'.format(
                cgi_script.script_path
            )
            raise SysError(msg=msg, code='CGI_CONF_NO_EXEC')

        return cgi_script

    @property
    def script_path(self):
        return os.path.join(CGI_SCRIPTS_DIR, self.name)


def cgi_config():
    scripts = {}
    scripts_dir = config['cgi']['scripts_dir']

    for file_name in os.listdir(scripts_dir):
        script_conf_section = 'cgi_{}'.format(file_name)

        if script_conf_section not in config:
            error_log.warning('CGI script %s is not configured and it will '
                              'not be run.', file_name)
            continue

        route = config[script_conf_section]['route']
        msg = "Scripts {fn_1} and {fn_2} are in conflict for route {route}."

        if route in scripts:
            raise SysError(msg=msg.format(fn_1=file_name, fn_2=scripts[route],
                                          route=route),
                           code='CGI_CONFIG_CONFLICT')

        script = CGIScript.from_config(file_name)
        scripts[script.route] = script

    return scripts


def find_cgi_script(uri):
    assert uri.is_in_absolute_form or uri.is_in_origin_form

    highest_match = (None, 0)

    uri_path = uri.path

    if not uri.path.endswith('/'):
        uri_path += '/'

    for script_route in CGI_SCRIPTS:
        if not uri_path.startswith(script_route):
            continue

        sr_parts = script_route.split('/')
        path_parts = uri_path.split('/')
        matching = sum(1 for path_part, sr_part in zip(path_parts, sr_parts)
                       if path_part == sr_part)

        if matching > highest_match[1]:
            highest_match = (script_route, matching)

    if not highest_match[0]:
        return None
    else:
        return CGI_SCRIPTS[highest_match[0]]


def compute_path_info(cgi_script, uri):
    assert isinstance(cgi_script, CGIScript)
    assert uri.is_in_absolute_form or uri.is_in_origin_form

    if cgi_script.pass_full_path_info:
        encoded_path_info = uri.path
    else:
        cgi_route = normalized_route(cgi_script.route)
        request_route = normalized_route(uri.path)

        assert request_route.startswith(cgi_route)

        encoded_path_info = request_route[len(cgi_route) - 1:]

    # TODO should this raise errors if url decoding creates extre '/' ?
    return ws.http.utils.decode_uri_component(encoded_path_info)


def compute_path_translated(path_info):
    # TODO document root ?
    return os.path.abspath(path_info)


def compute_query_string(uri):
    if not uri.query:
        return ''
    else:
        return uri.query


def compute_http_headers_env(request):
    env = {}

    skipped_headers = ('Content-Length', 'Content-Type')

    for header, value in request.headers.items():
        if header in skipped_headers:
            continue
        env_name = 'HTTP_' + header.upper().strip().replace('-', '_')
        folded_val = value.replace(b'\n', b' ').strip(b' ').decode('ascii')
        env[env_name] = folded_val

    return env


def can_handle_request(request):
    return bool(find_cgi_script(request.request_line.request_target))


def execute_script(request, address):
    assert can_handle_request(request)

    uri = request.request_line.request_target
    cgi_script = find_cgi_script(uri)

    error_log.info('Executing CGI script %s', cgi_script.name)
    script_env = {**compute_http_headers_env(request)}

    if not isinstance(request.body, bytes):
        body = b''.join(request.body)
    else:
        body = request.body

    script_env['GATEWAY_INTERFACE'] = 'CGI/1.1'
    script_env['PATH_INFO'] = compute_path_info(cgi_script, uri)
    script_env['PATH_TRANSLATED'] = compute_path_translated(
        script_env['PATH_INFO']
    )
    script_env['QUERY_STRING'] = compute_query_string(uri)
    script_env['REMOTE_ADDR'] = address[0]
    # TODO script_env['REMOTE_HOST'] =
    script_env['REQUEST_METHOD'] = request.request_line.method
    script_env['SCRIPT_NAME'] = cgi_script.route
    script_env['SERVER_NAME'] = config['settings']['host']
    script_env['SERVER_PORT'] = config['settings']['port']
    script_env['SERVER_PROTOCOL'] = 'HTTP/1.1'
    script_env['SERVER_SOFTWARE'] = 'web-server-v0.3.0rc'
    if body:
        script_env['Content-Length'] = request.headers['Content-Length']
        script_env['Content-Encoding'] = request.headers['Content-']

    try:
        proc = subprocess.Popen(
            args=(os.path.abspath(cgi_script.script_path), ),
            env=script_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
    except (OSError, ValueError):
        error_log.exception('Failed to open subprocess for cgi script {}.'
                            .format(cgi_script.name))
        return ws.http.utils.build_response(500)

    try:
        outs, err = proc.communicate(body,
                                     timeout=config.getint(cgi_script.timeout))
    except subprocess.TimeoutExpired:
        error_log.exception('CGI script {} timed out.'.format(cgi_script.name))
        proc.kill()
        return ws.http.utils.build_response(503)

    print(outs, err)

    return ws.http.utils.build_response(404)


def normalized_route(route):
    if not route.startswith('/'):
        return route + '/'
    else:
        return route


CGI_SCRIPTS = cgi_config()


