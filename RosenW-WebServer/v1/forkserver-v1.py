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
    self.env = {}
    self.max_subprocess_count = opts['subprocess_count']
    self.workers = 0
    self.timeout = opts['timeout']
    signal.signal(signal.SIGCHLD, self.kill_children) # TODO make non-controversial

  def start(self):
    connection = None
    pid = None

    while True:
      try:
        connection, client_address = self.sock.accept()
        self.log.debug(self.workers)
        if self.workers >= self.max_subprocess_count:
          raise SubprocessLimitError('Accepted Connection, but workers where over the allowed limit')
        self.log.info('accepted connection: {}'.format(client_address))

        self.workers += 1
        pid = os.fork()
        if pid == 0:
          try:
            self.handle_request(connection, client_address)
          except BaseException as e:
            self.log.error(e)
          finally:
            break
      except SubprocessLimitError as e:
        try:
          self.log.warn(e)
          send(connection, self.generate_headers(503))
        except BaseException as ex:
          self.log.error(ex)
      except IOError as e:
        if e.errno != os.errno.EINTR:
          try:
            self.log.error(e)
            send(connection, self.generate_headers(500))
          except BaseException as ex:
            self.log.error(ex)
          self.log.error(e)
        else:
          pass
      except (OSError, IndexError, ValueError) as e:
        try:
          self.log.error(e)
          send(connection, self.generate_headers(500))
        except BaseException as ex:
          self.log.error(ex)
        self.log.error(e)
      except KeyboardInterrupt as e:
        self.log.info('Stopping Server...')
        break
      except BaseException as e:
        self.log.error(e)
        break
      finally:
        if connection and pid != 0:
          self.log.debug('Server closing sending socket')
          connection.close()

    sys.exit()

  def handle_request(self, connection, client_address):
    request = None

    try:
      self.sock.close()
      assert type(client_address) is tuple and len(client_address) == 2 # TODO isinstance of
      self.env = {'host': client_address[0], 'port': client_address[1]}
      connection.settimeout(self.timeout)
      request = self.recv_request(connection)
      self.env['request_time'] = time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime())
      self.parse_request(request)

      if self.env['request_method'] == 'GET':
        html = self.get_requested_file(self.env['whole_path'])

      send(connection, self.generate_headers(200))
      send(connection, html)
    except KeyboardInterrupt as e:
      pass
    except PeerError as e:
      self.log.warn(e)
      send(connection, self.generate_headers(400))
    except FileNotFoundError as e:
      self.log.warn(e)
      send(connection, self.generate_headers(404))
    except socket.timeout as e:
      self.log.warn(e)
      send(connection, self.generate_headers(408))
    except BaseException as e:
      self.log.error(e)
      send(connection, self.generate_headers(500))
    finally:
      connection.close()
      if request:
        self.log_request(request)
    self.log.info('Request Handled')

  def get_requested_file(self, path):
    try:
      path = self.resolve_path(path)
      self.log.info(os.path.abspath('./static/{}'.format(path)))
      with open('./static{}'.format(path), "r") as file:
        return file.read()
    except IOError:
      raise FileNotFoundError('File not found: {}'.format(path), 'FILE_NOT_FOUND')

  def parse_request(self, request):
    assert type(request) is str
    assert len(request) > 0

    self.env['request_first_line'] = request.splitlines()[0].rstrip('\r\n')

    tokens = self.env['request_first_line'].split()
    assert len(tokens) == 3
    (
      self.env['request_method'],  # GET
      self.env['whole_path'],      # /hello.html
      self.env['request_version']  # HTTP/1.1
    ) = tokens

  def log_request(self, request):
    today = datetime.date.today()
    now = str(datetime.datetime.now())

    assert type(self.env['host']) is str and type(self.env['port']) is int
    assert self.env

    # TODO self.env.get('host', '-')
    with open('./logs/access.log', "a+") as file:
      file.write('{} {} {} {} "{}" {} {}\n'.format(
        self.env['host'] if 'host' in self.env else '-',
        self.env['remote_logname'] if 'remote_logname' in self.env else '-',
        self.env['remote_user'] if 'remote_user' in self.env else '-',
        self.env['request_time'] if 'request_time' in self.env else '-',
        self.env['request_first_line'] if 'request_first_line' in self.env else '-',
        self.env['status_code'] if 'status_code' in self.env else '-',
        self.env['content_length'] if 'content_length' in self.env and self.env['content_length'] > 0 else '-'
      ))
    self.log.info('request logged')

  def recv_request(self, connection):
    data = connection.recv(1024)
    while '\r\n\r\n' not in data:
      data += connection.recv(1024)
    total_length = self.parse_headers(data)
    while len(data) != total_length:
      data += connection.recv(1024)
    self.log.info('Request Recved')
    return data

  def parse_headers(self, data):
    self.log.debug('data')
    self.log.debug(data)
    assertPeer(len(data) <= 1024, 'Headers too long', 'HEADERS_TOO_LONG')
    headers_length = data.find('\r\n\r\n') + self.HEADERS_END_STRING_LENGTH
    header_dict = {}
    for header in data[:headers_length].split('\r\n'):
      if ': ' in header:
        header_tokens = header.split(': ')
        header_dict[header_tokens[0]] = header_tokens[1]
    if 'Content-Length' in header_dict:
      content_length = header_dict['Content-Length']
    else:
      content_length = 0

    self.env['headers'] = header_dict
    self.env['headers_length'] = headers_length
    self.env['content_length'] = content_length

    return headers_length + content_length

  def generate_headers(self, response_code):
    self.env['status_code'] = response_code

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
      header += 'HTTP/1.1 500 Internal Server Error\r\n'

    header += 'Date: {}\r\n'.format(time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime()))
    header += 'Connection: close\r\n\r\n'
    self.response_code = response_code
    return header

  def resolve_path(self, path):
    path = path.replace('../', '')
    if os.path.islink(path):
      return ''
    return path

  def kill_children(self, signum, frame):
    try:
      while True:
        (pid, exit_status) = os.waitpid(-1, os.WNOHANG)
        if pid == 0:
          break
        self.workers -= 1
    except BaseException as e:
      if e.errno != os.errno.ECHILD:
        self.log.error(e)

if __name__ == '__main__':
  DEFAULT_REQUEST_QUEUE_SIZE = 5
  DEFAULT_TIMEOUT = 5
  DEFAULT_ADDRESS = ''
  DEFAULT_PORT = 8888
  DEFAULT_SUBPROCESS_COUNT = 20

  config = ConfigParser()
  config.read('./etc/config.ini')

  port = config.get('server', 'port')
  address = config.get('server', 'address')
  request_queue_size = config.get('server', 'request_queue_size')
  timeout = config.get('server', 'timeout')
  subprocess_count = config.get('server', 'subprocess_count')

  opts = {
    'port': port if type(port) is int else DEFAULT_PORT,
    'address': address or DEFAULT_ADDRESS,
    'request_queue_size': request_queue_size if type(request_queue_size) is int else DEFAULT_REQUEST_QUEUE_SIZE,
    'timeout': timeout if type(timeout) is int else DEFAULT_TIMEOUT,
    'subprocess_count': subprocess_count if type(subprocess_count) is int else DEFAULT_SUBPROCESS_COUNT
  }

  Server(opts).start()