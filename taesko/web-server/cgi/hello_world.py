#!/usr/bin/env python3
import os
import sys

content_length = int(os.environ['Content-Length'])

with open('/tmp/uploaded', mode='w') as f:
    read_body = 0
    while read_body < content_length:
        chunk = sys.stdin.read(4096)
        read_body += len(chunk)
        f.write(chunk)
    print('HTTP/1.1 200 OK')
    print('environ was: ', os.environ)
    sys.stdout.flush()
