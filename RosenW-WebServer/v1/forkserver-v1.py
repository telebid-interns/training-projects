#!/usr/bin/python
import socket
import sys
import time
import signal
import os
import datetime

class Server:
  address_family = socket.AF_INET #IPv4 addresses
  socket_type = socket.SOCK_STREAM
  request_queue_size = 5;

  def __init__(self, address, port):
    self.listen_socket = socket.socket(self.address_family, self.socket_type)
    self.listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) #level, optname, value
    self.listen_socket.bind((address, port))
    self.listen_socket.listen(self.request_queue_size)
    # signal.signal(signal.SIGCHLD, self.kill_child)
    print('Server started on port {}'.format(port))

  def start (self):
    print('START')

    while 1:
      try:
        self.connection, self.client_address = self.listen_socket.accept()
        print('accepted connection: {}'.format(self.client_address))

        pid = os.fork()
        if pid == 0:
          self.handle_request()
          print('request handled')
          break
      except Exception as e:
        with open('./logs/error.log', "a+") as file:
          file.write('Error Info:\n{}\n{}\n\n'.format(str(datetime.datetime.now()), e))

  def handle_request(self):
    print('handling')
    try:
      #receive request data
      request = self.recv_timeout()

      self.parse_request(request)
      self.log_request(request)

      print('gen resp')
      response = self.generate_header(200)
      print('gen file')
      print(self.whole_path)
      html = self.get_requested_file(self.whole_path)
      print('after')

      if self.request_method == 'GET': response += html
      self.connection.send(response)
    except Exception as e:
      self.connection.send("HTTP/1.1 500 INTERNAL SERVER ERROR\n\n")
      raise e
    finally:
      self.connection.close()

  def get_requested_file(self, path):
    try:
      with open('./static/{}'.format(path), "r") as file:
        return file.read()
    except:
      return """
                <html>
                    <head>
                    </head>
                    <body>
                        <p>Not Found 404<p>
                    </body>
                </html>
              """

  def parse_request(self, request):
    line = request.splitlines()[0]
    line = line.rstrip('\r\n') #trim
    # Break down the request line into components
    (self.request_method,  # GET
     self.whole_path,      # /hello
     self.request_version  # HTTP/1.1
     ) = line.split()

  def log_request(self, request):
    today = datetime.date.today()
    now = str(datetime.datetime.now())

    with open('./logs/access.log', "a+") as file:
      file.write('IP: {}\n'.format(str(self.client_address)))
      file.write('DATE: {}\n'.format(now))
      file.write(request)

  def recv_timeout(self, timeout=0.01):
    #total data partwise in an array
    total_data=[];
    data='';

    startTime=time.time()

    while 1:
      #break after timeout if data
      if total_data and time.time() - startTime > timeout:
        break
      #wait twice if no data then break
      elif time.time() - startTime > timeout*2:
        break

      #recv
      data = self.connection.recv(1024)
      if data:
        total_data.append(data)
        startTime=time.time()
      else:
        # sleep for sometime to indicate a gap
        time.sleep(0.1)

      #join all parts to make final string
      return ''.join(total_data)

  def generate_header(self, response_code):
    header = ''
    if response_code == 200:
        header += 'HTTP/1.1 200 OK\n'
    elif response_code == 404:
        header += 'HTTP/1.1 404 Not Found\n'

    time_now = time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime())
    header += 'Date: {now}\n'.format(now=time_now)
    header += 'Connection: close\n\n' # Signal that connection will be closed after completing the request
    return header

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

if __name__ == '__main__':
  port = 8888
  address = '' # empty address by default uses all available
  args = sys.argv
  for index in range(len(args)):
    arg = args[index]
    if arg == '-p':
      port = int(args[index + 1])
    if arg == '-a':
      address = args[index + 1]

  server = Server(address, port)
  server.start()