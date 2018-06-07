import socket
import codecs
import datetime
import os

class Server:
    address_family = socket.AF_INET
    socket_type = socket.SOCK_STREAM
    request_queue_size = 1

    def __init__(self, server_address):
        self.listen_socket = listen_socket = socket.socket(self.address_family, self.socket_type)
        listen_socket.bind(server_address)
        listen_socket.listen(self.request_queue_size)

    def start(self):
        print 'Server Started'
        listen_socket = self.listen_socket
        while True:
            # New client connection
            self.client_connection, client_address = listen_socket.accept()
            # Handle one request and close the client connection. Then
            # loop over to wait for another client connection
            self.handle_request()

    def handle_request(self):
        #receive request data
        self.request = request = self.client_connection.recv(1024)

        file = open("./logs/logs.txt","a+")
        file.write(str(datetime.datetime.now()) + "\n")
        # TODO: file.write(os.environ['REMOTE_USER']) 
        file.write(request)
        file.close()

        # Print formatted request data a la 'curl -v'
        print(''.join(
            '< {line}\n'.format(line=line)
            for line in request.splitlines()
        ))

        self.parse_request(request)

        # Construct a response and send it back to the client
        self.send_response()

    def parse_request(self, request):
        line = request.splitlines()[0]
        line = line.rstrip('\r\n')
        # Break down the request line into components
        (self.request_method,  # GET
         self.path,            # /hello
         self.request_version  # HTTP/1.1
         ) = line.split()

    def send_response(self):
        try:
            response = self.dispatch_request(self.path, self.request_method)
            self.client_connection.sendall(response)
        except Exception as e:
            print e
        finally:
            self.client_connection.close()

    def dispatch_request(self, path, method):
        if self.request_method == 'GET':
            return self.call_get_function(path)
        else:
            return self.call_post_function(path)

    def call_get_function(self, path):
        try:
            print path
            func = {
                '/sum': self.get_sum,
                '/file': self.get_file
            }.get(path)
            return func()
        except Exception as e:
            print 'No such route'

    def call_post_function(self, path):
        try:
            print path
            func = {
                '/file': self.post_file
            }.get(path)
            return func()
        except Exception as e:
            print 'PAGE DOES NOT EXIST'

    def get_page(self, path):
        #try return error code etc
        htmlf=codecs.open("./views/" + path + ".html", 'r', 'utf-8')
        return "HTTP/1.1 200 OK\n\n" + htmlf.read()

    def get_sum(self):
        return self.get_page('sum')

    def get_file(self):
        return self.get_page('file')

    def post_file(self):
        print self.request
        return self.get_file()

if __name__ == '__main__':
    server = Server(('', 8888))
    server.start()
