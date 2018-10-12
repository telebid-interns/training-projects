import socket

host = ''
port = 8080

socket_descr = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
socket_descr.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

socket_descr.bind((host, port))

socket_descr.listen(1)

while True:
    conn, addr = socket_descr.accept()
    print(conn)
    print(addr)
    print(type(conn))
    print('Connected with {0}:{1}'.format(addr[0], addr[1]))
    conn.sendall('Hello world'.encode())
    conn.close()

socket_descr.close()

