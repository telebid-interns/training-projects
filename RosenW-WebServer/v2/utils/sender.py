def send(socket, data):
    socket.sendall(data.encode('UTF-8'))
