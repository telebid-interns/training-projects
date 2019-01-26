#ifndef CLIENT_CONNECTION_HH
#define CLIENT_CONNECTION_HH

#include "socket.hh"

class ClientConnection {
  private:
    int fd;
  public:
    ClientConnection(Socket);
    ~ClientConnection();
    void receive_meta();
    void receive();
    void send_meta();
    void send();
    void serve_static_file();
};

#endif
