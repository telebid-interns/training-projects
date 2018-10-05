import collections
import socket
import time

from ws.err import *
from ws.logs import error_log


class ClientSocket:
    """ Optimal byte iterator over plain sockets.

    The __next__ method of this class ALWAYS returns one byte from the
    underlying socket or raises an exception.

    Exceptions raised:
        PeerError(code='CS_PEER_SEND_IS_TOO_SLOW') - when __next__ is called
            and the socket times out.
        PeerError(code='CS_PEER_NOT_SENDING' - when __next__ is called and
            the client sends 0 bytes through the socket indication he is done.
        PeerError(code='CS_CONNECTION_TIMED_OUT') - when __next__ is but
            the connection_timeout has been exceeded.
        StopIteration() - if __next__ is called after the socket was broken

        PeerError(code='CS_PEER_NOT_RECEIVING') - when send_all is called
            but the socket has been shutdown for sending from the peer.
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

        if self.connected_on < time.time():
            raise PeerError(msg='Connection with peer timed out.',
                            code='CS_CONNECTION_TIMED_OUT')

        try:
            chunk = self.sock.recv(self.__class__.buffer_size)
        except socket.timeout as e:
            error_log.exception('Socket timed out while receiving request.')
            raise PeerError(msg='Waited too long for a request',
                            code='CS_PEER_SEND_IS_TOO_SLOW') from e

        error_log.debug('Read chunk %s', chunk)

        if chunk == b'':
            error_log.info('Socket %d broke', self.sock.fileno())
            self.socket_broke = True
            raise PeerError(code='CS_PEER_NOT_SENDING',
                            msg='Client send 0 bytes through socket.')

        self.chunks.append(chunk)
        self.current_chunk = iter(chunk)

        return next(self.current_chunk)

    def recv_until_after(self, bytes_token, recv_max_bytes):
        assert isinstance(bytes_token, bytes)
        assert len(bytes_token) > 0

        last = collections.deque(maxlen=len(bytes_token))

        for count, byte in enumerate(self):
            assert_peer(count != recv_max_bytes,
                        msg='Reached max bytes for recv_until_after call. '
                            'Peer is most likely sending a very long response.',
                        code='PEER_SENDING_TOO_MUCH')
            yield byte

            last.append(byte)

            if b''.join(last) == bytes_token:
                return

    def send_all(self, bytes_response):
        assert isinstance(bytes_response, bytes)

        total_sent = 0

        while total_sent < len(bytes_response):
            sent = self.sock.send(bytes_response[total_sent:])
            assert_peer(sent != 0,
                        msg='Peer broke socket connection while server '
                            'was sending.',
                        code='CS_PEER_NOT_RECEIVING')
            total_sent += sent

    def reiterate(self):
        self.current_chunk = b''.join(self.chunks)

    def shutdown(self, how):
        msgs = {
            socket.SHUT_RD: 'Shutting down socket %d for reading/receiving.',
            socket.SHUT_WR: 'Shutting down socket %d for writing/sending.',
            socket.SHUT_RDWR: 'Shutting down socket %d for both r/w.'
        }
        error_log.info(msgs[how], self.sock.fileno())

        self.sock.shutdown(how)

    def close(self):
        error_log.info('Closing socket %d', self.sock.fileno())
        self.sock.close()
