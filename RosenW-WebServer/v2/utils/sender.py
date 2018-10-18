import traceback
import os

def sendall(socket, data):
    try: 
        if isinstance(data, str):
            data = data.encode()
        socket.sendall(data)
    except OSError as e:
        if e.errno != os.errno.EPIPE:
            pass
    except BaseException as ex:
        try:
            traceback.print_exc()
        except:
            pass
