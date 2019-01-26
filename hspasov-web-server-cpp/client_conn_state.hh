#ifndef CLIENT_CONN_STATE_HH
#define CLIENT_CONN_STATE_HH

enum client_conn_state {
  ESTABLISHED,
  RECEIVING,
  SENDING,
  SHUTDOWN,
  CLOSED
};

#endif
