import traceback

def sendall(socket, data):
    try: 
        if isinstance(data, str):
            data = data.encode()
        socket.sendall(data)
    except BaseException as ex:
        try:
            traceback.print_exc()
        except:
            pass
