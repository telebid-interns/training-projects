#!/usr/bin/python
import socket
import codecs
import datetime
import os
import time
import re

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
            self.client_connection, self.client_address = listen_socket.accept()
            # Handle one request and close the client connection. Then
            # loop over to wait for another client connection
            self.handle_request()

    def handle_request(self):
        #receive request data
        self.request = request = self.recv_timeout(self.client_connection)
        today = datetime.date.today()
        now = str(datetime.datetime.now())

        try:
            file = open("./logs/%s.txt" % today,"a+")
            file.write('IP: ' + str(self.client_address) + '\n')
            file.write('DATE: ' + now + "\n")
            file.write(request)
        except Exception as e:
            print 'Error while logging: \n'
            print e
        finally:
            file.close()

        # Print formatted request data a la 'curl -v'
        print(''.join(
            '< {line}\n'.format(line=line)
            for line in request.splitlines()
        ))

        self.parse_request(request)

        # Construct a response and send it back to the client
        self.send_response(request)

    def parse_request(self, request):
        line = request.splitlines()[0]
        line = line.rstrip('\r\n')
        # Break down the request line into components
        (self.request_method,  # GET
         self.whole_path,            # /hello
         self.request_version  # HTTP/1.1
         ) = line.split()

    def send_response(self, request):
        try:
            response = self.dispatch_request(request)
            self.client_connection.sendall(response)
        except Exception as e:
            print e
        finally:
            self.client_connection.close()

    def dispatch_request(self, request):
        params = []
        if '?' in self.whole_path:
            pathTokens = self.whole_path.split('?')
            self.path = pathTokens[0]
            params_str = pathTokens[1]
            if '&' in params_str:
                params = params_str.split('&');
            else:
                params = [params_str]
        else:
            self.path = self.whole_path

        self.param_values = []
        for p in params:
            pTokens = p.split('=')
            self.param_values.append([pTokens[0], pTokens[1]])
        if self.request_method == 'GET':
            return self.call_get_function()
        else:
            return self.call_post_function()

    def call_get_function(self):
        try:
            func = {
                '/sum': self.get_sum,
                '/file': self.get_file
            }.get(self.path)
            return func()
        except Exception as e:
            print 'No such route'

    def call_post_function(self):
        try:
            func = {
                '/file': self.post_file
            }.get(self.path)
            return func()
        except Exception as e:
            print 'PAGE DOES NOT EXIST'

    def get_sum(self):
        nums = []
        result = 0
        for pkv in self.param_values:
            result += int(pkv[1])
        return "HTTP/1.1 200 OK\n\n" + str(result)

    def get_file(self):
        htmlf=codecs.open("./views/file.html", 'r', 'utf-8')
        return "HTTP/1.1 200 OK\n\n" + htmlf.read()

    def post_file(self):
        inside = False
        startAppending = 0
        fileName = ''
        fileContent = ''
        for line in self.request.split('\n'):
            if inside == True:
                startAppending+=1
            if line[:6] == '------':
                if inside:
                    inside = False
                else:
                    inside = True
            if startAppending > 3 and inside:
                fileContent += line + '\n'
            for part in line.split():
                if part.startswith('filename='):
                    fileName = part[10:-1]

        file = open("./received-files/%s" % fileName,"w+")
        file.write(fileContent)
        file.close()

        print 'end'
        print self.request
        return self.get_file()


    def recv_timeout(self, the_socket, timeout=1):
        #make socket non blocking
        the_socket.setblocking(0)

        #total data partwise in an array
        total_data=[];
        data='';

        #beginning time
        begin=time.time()
        while 1:
            #if you got some data, then break after timeout
            if total_data and time.time()-begin > timeout:
                break

            #if you got no data at all, wait a little longer, twice the timeout
            elif time.time()-begin > timeout*2:
                break

            #recv something
            try:
                data = the_socket.recv(1024)
                if data:
                    total_data.append(data)
                    #change the beginning time for measurement
                    begin=time.time()
                else:
                    #sleep for sometime to indicate a gap
                    time.sleep(0.1)
            except:
                pass

        #join all parts to make final string
        return ''.join(total_data)

if __name__ == '__main__':
    server = Server(('', 8887))
    server.start()
