#!/usr/bin/python
import socket
import datetime
import os
import time
import re
import sys
from threading import Thread
import psutil
import ssl
import signal
import Cookie

class Server:
    address_family = socket.AF_INET #IPv4 addresses
    socket_type = socket.SOCK_STREAM
    request_queue_size = 1

    cur_user = ''
    cur_pass = ''

    user = 'ros'
    password = '1234'

    def __init__(self, server_address):
        self.listen_socket = socket.socket(self.address_family, self.socket_type)
        self.listen_socket = ssl.wrap_socket(
            self.listen_socket,
            keyfile='./ssl/server.key',
            certfile='./ssl/server.crt',
            server_side=True)
        self.listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) #level, optname, value
        self.listen_socket.bind(server_address)
        self.listen_socket.listen(self.request_queue_size)
        print 'Server started on port %s' % server_address[1]

    def start(self):
        counter = 0
        main_process = os.getpid()
        monintor_process_id = os.fork()
        if monintor_process_id == 0:
            self.start_monitoring(main_process)
        signal.signal(signal.SIGCHLD, self.kill_child)

        while True:
            try:
                self.client_connection, self.client_address = self.listen_socket.accept()

                pid = os.fork()
                if pid == 0:
                    self.handle_request()
                    break
            except Exception as e:
                # self.client_connection.sendall("HTTP/1.1 500 INTERNAL SERVER ERROR\n\n")
                print e
            finally:
                self.client_connection.close()

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
         self.whole_path,      # /hello
         self.request_version  # HTTP/1.1
         ) = line.split()

    def send_response(self, request):
        response = self.dispatch_request(request)
        self.client_connection.sendall(response)

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
                '/file': self.get_file,
                '/login': self.get_login
            }.get(self.path)
            return func()
        except Exception as e:
            print e
            return "HTTP/1.1 404 NOT FOUND\n\n"

    def call_post_function(self):
        try:
            func = {
                '/file': self.post_file,
                '/login': self.post_login
            }.get(self.path)
            return func()
        except Exception as e:
            return "HTTP/1.1 404 NOT FOUND\n\n"

    def get_login(self):
        return  """HTTP/1.1 200 OK

                <html>
                    <head>
                    </head>
                    <body>
                      </br>
                      <form method='post' action='/login'>
                          <label>User</label>
                          <input id='user' type="text" name="user">
                          </br>
                          <label>Password</label>
                          <input id='pass' type="text" name="pass">
                          </br>
                          <input id='submit' type="submit" value="Log In">
                          </br>
                      </form>
                    </body>
                </html>
                """

    def post_login(self):
        pairs = self.request.split('?')
        for pair in pairs:
            pass
        print self.request
        #CONTINUE
        return self.get_sum()

    def get_sum(self):
        if not self.is_logged_in():
            return self.get_login()

        nums = []
        result = 0
        for pkv in self.param_values:
            result += int(pkv[1])
        return  """HTTP/1.1 200 OK

                <html>
                    <head>
                    </head>
                    <body>
                      <a href="/file"> Go to file </a>
                      </br>
                      <form method='get'>
                          <input id='first' type="text" name="first">
                          </br>
                          <input id='second' type="text" name="second">
                          </br>
                          <input id='submit' type="submit">
                          </br>
                          <input id='result' type="text" value="{0}" disabled>
                          </br>
                      </form>
                    </body>
                </html>
                """.format(result)

    def get_file(self):
        if not self.is_logged_in():
            return self.get_login()

        files = os.listdir('./received-files')
        filesAsParagraphs = ''
        for file in files:
            filesAsParagraphs += '<p>'+file+'</p>\n'
        try:
            returnStr = """HTTP/1.1 200 OK

                        <html>
                            <head>
                            </head>
                            <body>
                              <a href="/sum"> Go to sum </a>
                              </br>
                              <form method="post" enctype="multipart/form-data">
                                <input type='file' name='file'>
                                <input type='submit'>
                              </form>
                              <p>Uploaded Files: </p>
                              <ul>
                              {0}
                              </ul>
                            </body>
                        </html>"""
            return returnStr.format(filesAsParagraphs)
        except:
            return "HTTP/1.1 404 NOT FOUND\n\n"

    def post_file(self):
        try:
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


            if fileName:
                file = open("./received-files/%s" % fileName,"w+")
                file.write(fileContent)
                file.close()

            return self.get_file()
        except Exception as e:
            print e

    def recv_timeout(self, the_socket, timeout=0.01):
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
                    # sleep for sometime to indicate a gap
                    time.sleep(0.1)
            except:
                pass

        #join all parts to make final string
        return ''.join(total_data)

    def start_monitoring(self, main_process):
        print 'server process id: %s' % main_process
        while True:
            try:
                log_file = open("./monitoring/forkserver-parameters.txt","w")
                p = psutil.Process(main_process)
                report = 'SERVER CPU AND MEMORY USAGE: \n'
                report += '----CPU USAGE: ' + str(p.cpu_percent()) + '\n'
                report += '----RSS: ' + str(p.memory_info()[0]) + '\n'
                report += '----VMS: ' + str(p.memory_info()[1]) + '\n'
                log_file.write(report)
            except Exception as e:
                print 'Error while logging: \n'
                print e
            finally:
                log_file.close()
                time.sleep(0.1)

    def kill_child(self, signum, frame):
        while True:
            try:
                pid, status = os.waitpid(
                    -1,          # Wait for any child process
                     os.WNOHANG  # Do not block and return EWOULDBLOCK error
                )
            except OSError:
                return

            if pid == 0:  # no more zombies
                return

    def is_logged_in(self):
        if self.cur_user == self.user and self.cur_password == self.password:
            return True
        else:
            return False

if __name__ == '__main__':
    port = 8888
    address = ''
    args = sys.argv
    for index in range(len(args)):
        arg = args[index]
        if arg == '-p':
            port = int(args[index + 1])
        if arg == '-a':
            address = args[index + 1]

    server = Server((address, port))
    server.start()
