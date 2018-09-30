import logging
import os
import socket

from ws.config import config
from ws.err import *
from ws.http.response import Response

logger = logging.getLogger('error')
STATIC_ROUTE = config['routes']['static']
STATIC_DIR = config['resources']['static_dir']

assert_sys(STATIC_ROUTE.endswith('/'),
           msg="routes.static must end with a '/'",
           code='CONFIG_BAD_STATIC_ROUTE')
assert_sys(os.path.isdir(STATIC_DIR),
           msg='resources.static_dir field must be a directory',
           code='CONFIG_BAD_STATIC_DIR')


def serve_file(sock, route):
    assert isinstance(sock, socket.socket)

    if not route.startswith(STATIC_ROUTE):
        response = Response(status=404, headers={'Content-Type': 'ascii'})
        return serve_response(sock, response)

    rel_path = route[len(STATIC_ROUTE):]
    abs_path = os.path.join(STATIC_DIR, rel_path)

    with open(abs_path, mode='r', encoding='utf-8') as f:
        content = f.read()

    response = Response(status=200,
                        headers={
                            'Content-Length': len(content),
                            'Content-Type': 'ascii'
                        },
                        body=content)

    return serve_response(sock, response)


def serve_response(sock, response):
    logger.debug('Sending back response %s', response)
    return sock.sendall(bytes(response))
