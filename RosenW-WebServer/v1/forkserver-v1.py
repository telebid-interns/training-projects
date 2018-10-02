#!/usr/bin/python
import socket
import sys
import time
import signal
import os
import datetime
from error.asserts import *
from error.exceptions import *
from utils.logger import Logger
from ConfigParser import ConfigParser

class Server:
  HEADERS_END_STRING_LENGTH = 4
  ERROR_LOG_PATH = './logs/error.log'

  def __init__(self, opts):
    self.log = Logger({'error': self.ERROR_LOG_PATH})
    self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) # level, optname, value
    self.sock.bind((opts['address'], opts['port']))
    self.sock.listen(opts['request_queue_size'])
    self.log.info('Server started on port {}'.format(opts['port']))

  def start (self):
    while True:
      try:
        connection, client_address = self.sock.accept()
        self.log.info('accepted connection: {}'.format(client_address))

        if os.fork() == 0:
          self.handle_request(connection, client_address)
        else:
          connection.close()
      except KeyboardInterrupt as e:
        self.log.info('Stopping Server...')
        sys.exit()
      except BaseException as e: # TODO check if some exceptions need to stop the server
        self.log.error(e)

  def handle_request(self, connection, address):
    try:
      self.sock.close()
      request = self.recv_timeout(connection)
      self.parse_request(request)

      if self.request_method == 'GET':
        html = self.get_requested_file(self.whole_path)

      connection.send(self.generate_headers(200))
      connection.send(html) #assert ?
    except UserError:
      connection.send(self.generate_headers(408))
    except IOError:
      connection.send(self.generate_headers(404))
    except BaseException:
      connection.send(self.generate_headers(500))
    finally:
      self.log_request(request, address)
      connection.close()

  def get_requested_file(self, path):
    with open('./static/{}'.format(path), "r") as file:
      return file.read()

  def parse_request(self, request):
    assert type(request) is str and len(request) > 0
    line = request.splitlines()[0] # asserts
    line = line.rstrip('\r\n') #trim
    # Break down the request line into components
    tokens = line.split()
    assert len(tokens) == 3
    (self.request_method,  # GET
     self.whole_path,      # /hello.html
     self.request_version  # HTTP/1.1
     ) = tokens

  def log_request(self, request, address):
    today = datetime.date.today()
    now = str(datetime.datetime.now())

    assert type(address[0]) is str and type(address[1]) is int

    with open('./logs/access.log', "a+") as file:
      file.write('IP: {}\n'.format(address[0]))
      file.write('PORT: {}\n'.format(address[1]))
      file.write('DATE: {}\n'.format(now))
      file.write(request)

  def recv_timeout(self, connection, timeout = 5):
    start_time = time.time()
    data = connection.recv(1024)
    total_length = self.parse_recv_data(data)
    while len(data) != total_length:
      if time.time() - start_time > timeout:
        raise UserError('Request Timeout', 1000)
      data += connection.recv(1024)
    return data

  def parse_recv_data(self, data):
    if data.find('\r\n\r\n') == -1:
      raise BaseException('Headers too long') # TODO handle, custom BaseException, assert
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
      header += 'HTTP/1.1 200 OK\r\n'
    elif response_code == 404:
      header += 'HTTP/1.1 404 Not Found\r\n'
    elif response_code == 408:
      header += 'HTTP/1.1 408 Request Timeout\r\n'
    elif response_code == 500:
      header += 'HTTP/1.1 500 INTERNAL SERVER ERROR\r\n'

    header += 'Date: {}\r\n'.format(time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime()))
    header += 'Content-Type: text/html\r\n'
    header += 'Connection: close\r\n\r\n'
    return header

if __name__ == '__main__':
  DEFAULT_REQUEST_QUEUE_SIZE = 5
  DEFAULT_ADDRESS = ''
  DEFAULT_PORT = 8888

  config = ConfigParser()
  config.read('./etc/config.ini')

  port = config.getint('server', 'port')
  address = config.get('server', 'address')
  request_queue_size = config.getint('server', 'request_queue_size')

  assert type(port) is int
  assert type(address) is str
  assert type(request_queue_size) is int

  opts = {
    'port': port if port else DEFAULT_PORT,
    'address': address if address else DEFAULT_ADDRESS,
    'request_queue_size': request_queue_size if request_queue_size else DEFAULT_REQUEST_QUEUE_SIZE
  }

  Server(opts).start()