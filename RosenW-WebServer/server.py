import socket
import codecs

HOST, PORT = '', 8888

listen_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
listen_socket.bind((HOST, PORT))
listen_socket.listen(1)
print 'Serving HTTP on port %s ...' % PORT
while True:
    client_connection, client_address = listen_socket.accept()
    request = client_connection.recv(1024)

    requestTokens = request.split();
    # print requestTokens

    method = requestTokens[0];
    if method == 'GET':
        print 'get method'
    elif method == 'POST':
        print 'post method'

    htmlf=codecs.open("./views/hello.html", 'r', 'utf-8')
    print

    http_response = "HTTP/1.1 200 OK\n\n" + htmlf.read();
    client_connection.sendall(http_response)
    client_connection.close()
