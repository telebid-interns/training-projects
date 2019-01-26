#include "client_connection.hh"
#include "socket.hh"

ClientConnection::ClientConnection (const int conn)
  : conn(Socket(conn)) {}
// TODO check why Socket cant be passed by reference
