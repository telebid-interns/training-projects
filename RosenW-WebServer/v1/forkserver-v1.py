#!/usr/bin/python
import socket
import sys
import time
import signal
import os
import datetime
import logging # TODO google
from error.asserts import *

class Server:
  REQUEST_QUEUE_SIZE = 5
  HEADERS_END_STRING_LENGTH = 4

  def __init__(self, address, port):
    self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) #level, optname, value
    self.sock.bind((address, port))
    self.sock.listen(self.REQUEST_QUEUE_SIZE)
    print('Server started on port {}'.format(port))

  def start (self):
    while True:
      try:
        connection, client_address = self.sock.accept()
        print('accepted connection: {}'.format(client_address))

        pid = os.fork()
        if pid == 0:
          self.sock.close()
          self.handle_request(connection, client_address)
          print('request handled')
          break
        else:
          connection.close()
      except Exception as e:
        raise e
        # with open('./logs/error.log', "a+") as file:
        #   file.write('Error Info:\n{}\n{}\n\n'.format(str(datetime.datetime.now()), e))

  def handle_request(self, connection, address):
    try:
      #receive request data
      request = self.recv_timeout(connection)
      self.parse_request(request)
      self.log_request(request, address)

      headers = self.generate_headers(200)
      connection.send(headers)
      if self.request_method == 'GET':
        html = self.get_requested_file(self.whole_path)
        connection.send(html)
    except Exception as e:
      connection.send("HTTP/1.1 500 INTERNAL SERVER ERROR\n\n") # TODO finish also can send after headers already sent
      raise e
    finally:
      connection.close()

  def get_requested_file(self, path):
    try:
      with open('./static/{}'.format(path), "r") as file:
        return file.read()
    except Exception as e: # file not found exception
      return """<html>
                    <head>
                    </head>
                    <body>
                        <p>Not Found 404<p>
                    </body>
                </html>"""

  def parse_request(self, request):
    line = request.splitlines()[0] # asserts
    line = line.rstrip('\r\n') #trim
    # Break down the request line into components
    (self.request_method,  # GET
     self.whole_path,      # /hello
     self.request_version  # HTTP/1.1
     ) = line.split()

  def log_request(self, request, address):
    today = datetime.date.today()
    now = str(datetime.datetime.now())

    with open('./logs/access.log', "a+") as file:
      file.write('IP: {}\n'.format(str(address)))
      file.write('DATE: {}\n'.format(now))
      file.write(request)

  def recv_timeout(self, connection, timeout = 5):
    data = ''
    data += connection.recv(1024)
    total_length = self.parse_recv_data(data)
    while len(data) != total_length:
      data += connection.recv(1024)
    return data

  def parse_recv_data(self, data):
    # print(len(data))
    if data.find('\r\n\r\n') == -1: raise Exception('Headers too long') # TODO handle, custom exception
    headers_length = data.find('\r\n\r\n') + self.HEADERS_END_STRING_LENGTH
    header_dict = {}
    for header in data[:headers_length].split('\r\n'):
      if header.find(': ') != -1:
        header_tokens = header.split(': ')
        header_dict[header_tokens[0]] = header_tokens[1]
    if 'Content-Length' in header_dict:
      content_length = header_dict['Content-Length']
    else:
      content_length = 0
    return headers_length + content_length

  def generate_headers(self, response_code):
    header = ''
    if response_code == 200:
        header += 'HTTP/1.1 200 OK\n'
    elif response_code == 404:
        header += 'HTTP/1.1 404 Not Found\n'

    header += 'Host: 127.0.0.1'
    time_now = time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime())
    header += 'Date: {now}\n'.format(now=time_now)
    header += 'Content-Type: text/html\n'
    header += 'Connection: close\r\n\r\n' # Signal that connection will be closed after completing the request
    return header

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