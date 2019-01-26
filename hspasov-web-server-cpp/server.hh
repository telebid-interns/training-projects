#ifndef SERVER_HH
#define SERVER_HH

#include "socket.hh"
#include "client_connection.hh"

class Server {
  private:
    int socket_fd;
  public:
    Server();
    ~Server();
    void run();
    ClientConnection accept();
};

#endif
