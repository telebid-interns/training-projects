#!/usr/bin/python
import socket
import sys
import time
import signal
import os
import datetime
import traceback
from error.asserts import *
from error.exceptions import *
from utils.sender import *
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
          try:
            self.handle_request(connection, client_address)
          except BaseException as e:
            self.log.error(e)
          self.log.info('Request Handled')
          break
        else:
          connection.close()
      except KeyboardInterrupt as e:
        self.log.info('Stopping Server...')
        sys.exit()
      except IOError as e: # socket.error is child of IOError
        self.log.error(e)
      except BaseException as e: # TODO check if some exceptions need to stop the server
        self.log.error(e)

    sys.exit()

  def handle_request(self, connection, address):
    request = None

    try:
      self.sock.close()
      request = self.recv_request(connection)
      self.parse_request(request)

      if self.request_method == 'GET':
        html = self.get_requested_file(self.whole_path)

      send(connection, self.generate_headers(200))
      send(connection, html)
    except UserError as e:
      if e.status_code == 'RECEIVING_SOCKET_TIMEOUT':
        send(connection, self.generate_headers(408))
      else:
        send(connection, self.generate_headers(400))
      self.log.warn(e)
    except FileNotFoundException as e:
      send(connection, self.generate_headers(404))
      self.log.warn(e)
    except IOError as e:
      self.log.error(e)
    except BaseException as e:
      send(connection, self.generate_headers(500))
      self.log.error(e)
    finally:
      connection.close()
      if request:
        self.log_request(request, address)

  def get_requested_file(self, path):
    try:
      path = self.resolve_path(path)
      self.log.info(os.path.abspath('./static/{}'.format(path)))
      with open('./static{}'.format(path), "r") as file: # TODO security vulnerabilty
        return file.read()
    except IOError:
      raise FileNotFoundException('File not found: {}'.format(path)) # TODO change to peer

  def parse_request(self, request):
    assert type(request) is str
    assert len(request) > 0

    line = request.splitlines()[0]
    line = line.rstrip('\r\n')

    tokens = line.split()
    assert len(tokens) == 3
    (
      self.request_method,  # GET
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

  def recv_request(self, connection, timeout = 5):
    start_time = time.time()
    data = connection.recv(1024)
    total_length = self.parse_recv_data(data)
    while len(data) != total_length:
      assertUser(time.time() - start_time < timeout, 'Request Timeout', 'RECEIVING_SOCKET_TIMEOUT')
      data += connection.recv(1024)
    self.log.info('Request Recved')
    return data

  def parse_recv_data(self, data):
    assertUser(data.find('\r\n\r\n') != -1, 'Headers too long', 1001) # TODO use in
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

  def generate_headers(self, response_code): # TODO datafication
    header = ''
    if response_code == 200:
      header += 'HTTP/1.1 200 OK\r\n'
      header += 'Content-Type: text/html\r\n'
    elif response_code == 400:
      header += 'HTTP/1.1 400 Bad Request\r\n'
    elif response_code == 404:
      header += 'HTTP/1.1 404 Not Found\r\n'
    elif response_code == 408:
      header += 'HTTP/1.1 408 Request Timeout\r\n'
    elif response_code == 500:
      header += 'HTTP/1.1 500 INTERNAL SERVER ERROR\r\n'

    header += 'Date: {}\r\n'.format(time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime()))
    header += 'Connection: close\r\n\r\n'
    self.response_code = response_code
    return header

  def resolve_path(self, path):
    path = path.replace('../', '')
    if os.path.islink(path):
      return ''
    return path

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
    'address': address if address else DEFAULT_ADDRESS, # TODO replace with or
    'request_queue_size': request_queue_size if request_queue_size else DEFAULT_REQUEST_QUEUE_SIZE
  }

  Server(opts).start()