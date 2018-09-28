import os
import logging
import socket

from ws.http.response import Response
from ws.config import config
from ws.err import *


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
    assert route.startswith(STATIC_ROUTE)

    rel_path = route[len(STATIC_ROUTE):]
    abs_path = os.path.join(STATIC_DIR, rel_path)

    with open(abs_path, mode='r', encoding='utf-8') as f:
        content = f.read()

    response = Response(status=200,
                        headers={
                            'Content-Length': len(content)
                        },
                        body=content)

    logger.debug('Sending back response %s', response)
    return sock.sendall(bytes(response))
