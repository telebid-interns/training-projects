import traceback

def send(socket, data):
    try:
        socket.sendall(data.encode('UTF-8'))
    except BaseException as ex:
        try:
            traceback.print_exc()
        except:
            pass
