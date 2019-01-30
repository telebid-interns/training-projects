#ifndef CLIENT_CONN_STATE_HPP
#define CLIENT_CONN_STATE_HPP

enum client_conn_state {
  ESTABLISHED,
  RECEIVING,
  SENDING,
  SHUTDOWN,
  CLOSED
};

#endif
