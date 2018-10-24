import collections
import itertools
import socket
import time
from socket import SHUT_WR, SHUT_RD, SHUT_RDWR

from ws.err import *
from ws.logs import error_log


class ClientSocketException(ServerException):
    default_msg = 'Client socket caused an error.'
    default_code = 'CS_ERROR'

    def __init__(self, msg=default_code, code=default_code):
        super().__init__(msg=msg, code=code)


class ClientSocket:
    """ Optimal byte iterator over plain sockets.

    The __next__ method of this class ALWAYS returns one byte from the
    underlying socket or raises an exception.

    Exceptions raised during iteration:
        ClientSocketError(code='CS_PEER_SEND_IS_TOO_SLOW') - when __next__ is
            called and the socket times out.
        ClientSocketError(code='CS_PEER_NOT_SENDING' - when __next__ is called
            and the client sends 0 bytes through the socket indication he is done.
        ClientSocketError(code='CS_CONNECTION_TIMED_OUT') - when __next__ is
            called but the connection_timeout has been exceeded.
        StopIteration() - if __next__ is called after the socket was broken
    """
    buffer_size = 2048

    def __init__(self, sock, *, socket_timeout, connection_timeout):
        assert isinstance(sock, socket.socket)
        assert isinstance(socket_timeout, int)
        assert isinstance(connection_timeout, int)

        self.sock = sock
        self.chunks = []
        self.current_chunk = None
        self.socket_broke = False
        self.connection_timeout = connection_timeout
        self.connected_on = time.time()
        self.written = False

        self.sock.settimeout(socket_timeout)

    def __iter__(self):
        return self

    def __next__(self):
        if self.current_chunk:
            try:
                return next(self.current_chunk)
            except StopIteration:
                pass
        elif self.socket_broke:
            raise StopIteration()

        if self.connected_on + self.connection_timeout < time.time():
            raise ClientSocketException(code='CS_CONNECTION_TIMED_OUT')

        try:
            chunk = self.sock.recv(self.__class__.buffer_size)
        except socket.timeout as e:
            error_log.warning('Socket timed out while receiving request.')
            raise ClientSocketException(code='CS_PEER_SEND_IS_TOO_SLOW') from e

        error_log.debug3('Read chunk %s', chunk)

        if chunk == b'':
            error_log.info('Socket %d broke', self.sock.fileno())
            self.socket_broke = True
            raise ClientSocketException(code='CS_PEER_NOT_SENDING')

        self.chunks.append(chunk)
        self.current_chunk = iter(chunk)

        return next(self.current_chunk)

    def recv_until_after(self, bytes_token, recv_max_bytes):
        """ Yields bytes one by one until a bytes_token is met.

        Parameter :bytes_token: can be of any length less than :recv_max_bytes:.

        Raises the following exceptions:
            ClientSocketError(code='CS_PEER_SENDING_TOO_MUCH') - if the token
                is not met until :recv_max_bytes: are yielded

            All exceptions raised from __next__().
        """
        assert isinstance(bytes_token, bytes)
        assert len(bytes_token) > 0
        assert isinstance(recv_max_bytes, int)
        assert len(bytes_token) < recv_max_bytes

        last = collections.deque(maxlen=len(bytes_token))

        for count, byte in enumerate(self):
            if count == recv_max_bytes:
                raise ClientSocketException(code='CS_PEER_SENDING_TOO_MUCH')

            yield byte

            last.append(byte)

            if b''.join(last) == bytes_token:
                return

    def send_all(self, bytes_response):
        """ Sends bytes through the socket until everything is received.


        Raises the following exceptions:
            ClientSocketError(code='CS_PEER_NOT_RECEIVING') - the socket has
                been shutdown for sending from the peer.
        """
        assert isinstance(bytes_response, (bytes, bytearray))

        self.written = True
        total_sent = 0

        while total_sent < len(bytes_response):
            sent = self.sock.send(bytes_response[total_sent:])

            if sent == 0:
                raise ClientSocketException(code='CS_PEER_NOT_RECEIVING')

            total_sent += sent

    def reiterate(self):
        self.current_chunk = itertools.chain(*self.chunks)

    def fileno(self):
        return self.sock.fileno()

    def shutdown(self, how):
        msgs = {
            SHUT_RD: 'Shutting down socket %d for reading/receiving.',
            SHUT_WR: 'Shutting down socket %d for writing/sending.',
            SHUT_RDWR: 'Shutting down socket %d for both r/w.'
        }
        error_log.debug2(msgs[how], self.sock.fileno())

        self.sock.shutdown(how)

    def getsockname(self):
        return self.sock.getsockname()

    def getpeername(self):
        return self.sock.getpeername()

    def close(self, with_shutdown=False, pass_silently=False, safely=True):
        try:
            if with_shutdown:
                self.shutdown(SHUT_RDWR)
        except OSError as err:
            if not pass_silently:
                raise

            error_log.warning('Shutting down socket %s caused OSError '
                              'with ERRNO=%s and reason: %s',
                              self.fileno(), err.errno, err.strerror)
        finally:
            error_log.debug2('Closing socket %d', self.sock.fileno())
            try:
                self.sock.close()
            except OSError:
                if not pass_silently:
                    raise
