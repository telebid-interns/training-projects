import socket
import os
import signal
import time


signal.signal(signal.SIGCHLD, signal.SIG_IGN)
host="localhost"
port=5679
s=socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((host, port))
s.listen(10)

while True:
    print('accepting')
    cs, _ = s.accept()
    pid = os.fork()
    if not pid:
        print('handling request')
        s.close()
        print('received', cs.recv(4096))
        time.sleep(1)
        print('sent', cs.sendall(b'HTTP/1.0 404 Not Found\r\n'))
        cs.shutdown(socket.SHUT_WR)
        cs.recv(4096)
        cs.shutdown(socket.SHUT_RD)
        cs.close()
        break
    else:
        print('Forked child', pid)
        cs.close()
