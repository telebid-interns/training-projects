#ifndef CLIENT_CONNECTION_HH
#define CLIENT_CONNECTION_HH

#include "socket.hh"

class ClientConnection {
  private:
    Socket conn;
  public:
    ClientConnection(const int);
    // TODO ~ClientConnection();
    void receive_meta();
    void send_meta();
    void serve_static_file();
};

#endif
