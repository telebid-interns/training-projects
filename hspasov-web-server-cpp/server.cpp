#include "client_connection.hh"
#include "server.hh"
#include "logger.hh"
#include "error_log_fields.hh"
#include "error.hh"
#include <sys/socket.h>
#include <cerrno>

Server::Server () {
  // 0 is for protocol: "only a single protocol exists to support a particular socket type within a given protocol family, in which case protocol can be specified as 0" - from man page
  this->socket_fd = socket(AF_INET, SOCK_STREAM, 0);

  if (this->socket_fd < 0) {
    error_log_fields fields = { ERROR };
    fields.msg = "socket: " + errno;
    Logger::error(fields);

    throw Error("socket: " + errno);
  }

  // setting socket options:

  const int on = 1;

  if (setsockopt(this->socket_fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)) < 0) {
    error_log_fields fields = { ERROR };
    fields.msg = "setsockopt: " + errno;
    Logger::error(fields);

    throw Error("setsockopt: " + errno);
  }
}

ClientConnection Server::accept () {
  error_log_fields fields = { DEBUG };
  Logger::error(fields);

  sockaddr addr;
  socklen_t addrlen = sizeof(addr);

  int client_conn_fd = ::accept(this->socket_fd, &addr, &addrlen);

  if (client_conn_fd < 0) {
    error_log_fields fields = { ERROR };
    fields.msg = "accept: " + errno;
    Logger::error(fields);

    throw Error("accept: " + errno);

    // TODO: " For  reliable operation the application should detect the network errors defined for the protocol after accept() and treat them like EAGAIN by retrying.  In the case of TCP/IP, these are ENETDOWN, EPROTO, ENOPROTOOPT, EHOSTDOWN, ENONET, EHOSTUNREACH, EOPNOTSUPP, and ENETUNREACH."
  }

  // TODO put addr in ClientConnection

  return ClientConnection(Socket(client_conn_fd));
}
