def request_is_persistent(request):
    if request.request_line.http_version == 'HTTP/1.0':
        return ('Connection' in request.headers and
                b'Keep-Alive' in request.headers['Connection'])
    elif request.request_line.http_version == 'HTTP/1.1':
        return ('Connection' not in request.headers or
                b'close' not in request.headers['Connection'])
