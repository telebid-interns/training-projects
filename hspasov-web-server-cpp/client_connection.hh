#ifndef CLIENT_CONNECTION_HH
#define CLIENT_CONNECTION_HH

#include "socket.hh"
#include "client_conn_state.hh"
#include <string>

class ClientConnection {
  private:
    Socket conn;
    client_conn_state state;
    std::string req_meta_raw;
  public:
    ClientConnection(const int);
    // TODO later ~ClientConnection();
    void receive_meta();
    void send_meta();
    void serve_static_file();
};

#endif
