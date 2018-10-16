import traceback

def send(socket, data): # TODO rename sendall
    try: 
        socket.sendall(data.encode('UTF-8')) # TODO make data bytes
    except BaseException as ex:
        try:
            traceback.print_exc()
        except:
            pass
