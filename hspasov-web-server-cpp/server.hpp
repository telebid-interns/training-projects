#ifndef SERVER_HPP
#define SERVER_HPP

#include "socket.hpp"
#include "client_connection.hpp"
#include "logger.hpp"
#include "error_log_fields.hpp"
#include "error.hpp"
#include <sys/socket.h>
#include <cerrno>
#include <arpa/inet.h>
#include "config.hpp"
#include <unistd.h>

class Server {
  protected:
    int socket_fd;
  public:
    Server () {
      // 0 is for protocol: "only a single protocol exists to support a particular socket type within a given protocol family, in which case protocol can be specified as 0" - from man page
      this->socket_fd = socket(AF_INET, SOCK_STREAM, 0);

      if (this->socket_fd < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "socket: " + errno;
        Logger::error(fields);

        throw Error(ERROR, "socket: " + errno);
      }

      // setting socket options:

      const int on = 1;

      if (setsockopt(this->socket_fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "setsockopt: " + errno;
        Logger::error(fields);

        // because destructor would not be called after throw in constructor
        if (close(this->socket_fd) < 0) {
          error_log_fields fields = { ERROR };
          fields.msg = "close: " + errno;
          Logger::error(fields);
        }

        throw Error(ERROR, "setsockopt: " + errno);
      }
    }

    ClientConnection accept () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      sockaddr addr;
      socklen_t addrlen = sizeof(addr);

      int client_conn_fd = ::accept(this->socket_fd, &addr, &addrlen);

      if (client_conn_fd < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "accept: " + errno;
        Logger::error(fields);

        throw Error(DEBUG, "accept: " + errno);

        // TODO: " For  reliable operation the application should detect the network errors defined for the protocol after accept() and treat them like EAGAIN by retrying.  In the case of TCP/IP, these are ENETDOWN, EPROTO, ENOPROTOOPT, EHOSTDOWN, ENONET, EHOSTUNREACH, EOPNOTSUPP, and ENETUNREACH."
      }

      // TODO put addr in ClientConnection

      return ClientConnection(client_conn_fd);
    }

    void run () {
      // https://en.wikipedia.org/wiki/Type_punning#Sockets_example
      in_addr host;

      int inet_pton_result = inet_pton(AF_INET, Config::config["host"].GetString(), &host);

      // TODO resolve host to ip address using getaddrinfo
      if (inet_pton_result < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "inet_pton: " + errno;
        Logger::error(fields);

        throw Error(ERROR, "inet_pton: " + errno);
      } else if (inet_pton_result == 0) {
        throw Error(ERROR, "inet_pton got invalid network address");
      }

      sockaddr_in sa;
      sa.sin_family = AF_INET;
      sa.sin_port = htons(Config::config["port"].GetInt()); // host-to-network short. Makes sure number is stored in network byte order in memory, that means big-endian format (most significant byte comes first)
      sa.sin_addr = host;

      if (bind(this->socket_fd, (sockaddr*)&sa, sizeof(sa)) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "bind: " + errno;
        Logger::error(fields);

        throw Error(ERROR, "bind: " + errno);
      }

      if (listen(this->socket_fd, Config::config["backlog"].GetInt()) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "listen: " + errno;
        Logger::error(fields);

        throw Error(ERROR, "listen: " + errno);
      }

      error_log_fields fields = { DEBUG };
      fields.msg = "Listening on " + std::to_string(Config::config["port"].GetInt());
      Logger::error(fields);

      while (true) {
        ClientConnection client_conn = this->accept();

        error_log_fields fields = { DEBUG };
        fields.msg = "connection accepted";
        Logger::error(fields);

        client_conn.receive_meta();
      }
    }

    ~Server () {
      if (close(this->socket_fd) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "close: " + errno;
        Logger::error(fields);
      }
    }
};

#endif
