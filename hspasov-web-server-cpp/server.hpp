#ifndef SERVER_HPP
#define SERVER_HPP

#include "socket.hpp"
#include "client_connection.hpp"
#include "logger.hpp"
#include "error.hpp"
#include "config.hpp"
#include "addrinfo_res.hpp"
#include <cerrno>
#include <unistd.h>
#include <sys/socket.h>
#include <netdb.h>
#include <arpa/inet.h>

class Server {
  protected:
    int socket_fd;
  public:
    Server () {
      Logger::error(DEBUG, {});

      // 0 is for protocol: "only a single protocol exists to support a particular socket type within a given protocol family, in which case protocol can be specified as 0" - from man page
      this->socket_fd = socket(AF_INET, SOCK_STREAM, 0);

      if (this->socket_fd < 0) {
        Logger::error(DEBUG, {{ MSG, "socket: " + std::string(std::strerror(errno)) }});

        throw Error(OSERR, "socket: " + std::string(std::strerror(errno)), errno);
      }

      // setting socket options:

      const int on = 1;

      if (setsockopt(this->socket_fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)) < 0) {
        Logger::error(ERROR, {{ MSG, std::string(std::strerror(errno)) }});

        // because destructor would not be called after throw in constructor
        if (close(this->socket_fd) < 0) {
          Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
        }

        throw Error(OSERR, "setsockopt: " + std::string(std::strerror(errno)), errno);
      }
    }

    Server (const Server&) = delete;
    Server& operator= (const Server&) = delete;
    Server& operator= (const Server&&) = delete;

    Server (const Server&& server)
      : socket_fd(std::move(server.socket_fd)) {

      Logger::error(DEBUG, {});
    }


    ~Server () {
      Logger::error(DEBUG, {});

      if (close(this->socket_fd) < 0) {
        Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
      }
    }

    ClientConnection accept () const {
      Logger::error(DEBUG, {});

      sockaddr addr = {};
      socklen_t addrlen = sizeof(addr);

      const int client_conn_fd = accept4(this->socket_fd, &addr, &addrlen, SOCK_CLOEXEC);

      if (client_conn_fd < 0) {
        Logger::error(ERROR, {{ MSG, "accept: " + std::string(std::strerror(errno)) }});

        throw Error(OSERR, "accept: " + std::string(std::strerror(errno)), errno);
      }

      char remote_addr_buffer[INET_ADDRSTRLEN];

      sockaddr_in* addr_in = reinterpret_cast<sockaddr_in*>(&addr);

      if (inet_ntop(AF_INET, &(addr_in->sin_addr), static_cast<char*>(remote_addr_buffer), INET_ADDRSTRLEN) == nullptr) {
        throw Error(OSERR, "inet_ntop: " + std::string(std::strerror(errno)), errno);
      }

      const std::string remote_addr(static_cast<char*>(remote_addr_buffer));
      unsigned short remote_port = htons(addr_in->sin_port);

      return ClientConnection(client_conn_fd, remote_addr, remote_port);
    }

    void run () const {
      Logger::error(DEBUG, {});

      // https://en.wikipedia.org/wiki/Type_punning#Sockets_example

      const AddrinfoRes addrinfo_results(Config::config["host"].GetString(), std::to_string(Config::config["port"].GetInt()));

      for (addrinfo* res = addrinfo_results.addrinfo_res; res != nullptr; res = res->ai_next) {
        // TODO maybe should not throw on first failed bind
        if (bind(this->socket_fd, res->ai_addr, res->ai_addrlen) < 0) { // NOLINT
          Logger::error(ERROR, {{ MSG, "bind: " + std::string(std::strerror(errno)) }});

          throw Error(OSERR, "bind: " + std::string(std::strerror(errno)), errno);
        }

        break;
      }

      if (listen(this->socket_fd, Config::config["backlog"].GetInt()) < 0) {
        Logger::error(ERROR, {{ MSG, "listen: " + std::string(std::strerror(errno)) }});

        throw Error(OSERR, "listen: " + std::string(std::strerror(errno)), errno);
      }

      Logger::error(DEBUG, {{ MSG, "Listening on " + std::to_string(Config::config["port"].GetInt()) }});

      while (true) {
        try {
          ClientConnection client_conn = this->accept();

          // TODO fork

          try {
            Logger::error(DEBUG, {{ MSG, "connection accepted" }});

            client_conn.receive_meta();

            if (client_conn.state == RECEIVING) {
              client_conn.serve_static_file(client_conn.req_meta.path);
            }

            try {
              client_conn.shutdown();
            } catch (const Error& err) {
              if (err._type == CLIENTERR) {
                Logger::error(DEBUG, {{ MSG, "client already disconnected" }});
              } else {
                throw;
              }
            }

          } catch (const Error& err) {
            throw;
          }
          // TODO exit child process
        } catch (const Error& err) {
          if (err._errno == EAGAIN || err._errno == EWOULDBLOCK) {
            Logger::error(DEBUG, {{ MSG, err._msg }});
          } else {
            // TODO try to send 500
            Logger::error(ERROR, {{ MSG, err._msg }});
          }
        }
      }
    }
};

#endif
