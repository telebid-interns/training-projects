#ifndef SERVER_HPP
#define SERVER_HPP

#include "file_descriptor.hpp"
#include "socket.hpp"
#include "client_connection.hpp"
#include "logger.hpp"
#include "error.hpp"
#include "config.hpp"
#include "addrinfo_res.hpp"
#include <cstdlib>
#include <cerrno>
#include <unistd.h>
#include <sys/socket.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <signal.h>
#include <sys/wait.h>

void reap_child_proc (int sig_num) {
  const int any_pid = -1;
  int children_reaped = 0;

  while (true) {
    int exit_status = 0;

    const int child_pid = waitpid(any_pid, &exit_status, WNOHANG);

    if (child_pid == 0) {
      break;
    } else if (child_pid < 0) {
      Logger::error(DEBUG, {{ MSG, "waitpid: " + std::string(std::strerror(errno)) }});
      break;
    }

    children_reaped++;
  }

  Logger::error(DEBUG, {
    { MSG, "child reaping finished" },
    { VAR_NAME, "children_reaped" },
    { VAR_VALUE, std::to_string(children_reaped) }
  });
}

class Server {
  protected:
    FileDescriptor socket_fd;
  public:
    Server () {
      Logger::error(DEBUG, {});

      // 0 is for protocol: "only a single protocol exists to support a particular socket type within a given protocol family, in which case protocol can be specified as 0" - from man page
      int socket_fd = socket(AF_INET, SOCK_STREAM, 0);

      if (socket_fd < 0) {
        throw Error(OSERR, "socket: " + std::string(std::strerror(errno)), errno);
      }

      this->socket_fd.assign_fd(socket_fd);

      // setting socket options:

      const int on = 1;

      if (setsockopt(this->socket_fd._fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)) < 0) {
        // because destructor would not be called after throw in constructor
        // TODO check if FileDescriptor destructor is called
        throw Error(OSERR, "setsockopt: " + std::string(std::strerror(errno)), errno);
      }

      // setting child reaping:

      struct sigaction action;
      action.sa_handler = &reap_child_proc; // TODO is & necessary?
      action.sa_flags = SA_NOCLDSTOP;

      if (sigaction(SIGCHLD, &action, nullptr) < 0) {
        throw Error(OSERR, "sigaction: " + std::string(std::strerror(errno)), errno);
      }
    }

    Server (const Server&) = delete;
    Server& operator= (const Server&) = delete;
    Server& operator= (const Server&&) = delete;

    Server (const Server&& server)
      : socket_fd(std::move(server.socket_fd)) {

      Logger::error(DEBUG, {});
    }

    ClientConnection accept () const {
      Logger::error(DEBUG, {{ MSG, "waiting for connection..." }});

      sockaddr addr = {};
      socklen_t addrlen = sizeof(addr);

      const int client_conn_fd = accept4(this->socket_fd._fd, &addr, &addrlen, SOCK_CLOEXEC);

      if (client_conn_fd < 0) {
        throw Error(OSERR, "accept: " + std::string(std::strerror(errno)), errno);
      }

      // TODO maybe all these operations can occur in child process:
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
        if (bind(this->socket_fd._fd, res->ai_addr, res->ai_addrlen) < 0) { // NOLINT
          throw Error(OSERR, "bind: " + std::string(std::strerror(errno)), errno);
        }

        break;
      }

      if (listen(this->socket_fd._fd, Config::config["backlog"].GetInt()) < 0) {
        throw Error(OSERR, "listen: " + std::string(std::strerror(errno)), errno);
      }

      Logger::error(INFO, {{ MSG, "Listening on " + std::to_string(Config::config["port"].GetInt()) }});

      while (true) {
        try {
          ClientConnection client_conn = this->accept();

          const pid_t pid = fork();

          if (pid == 0) { // child process
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
              Logger::error(ERROR, {{ MSG, err._msg }});
              std::exit(EXIT_FAILURE);
            }

            std::exit(EXIT_SUCCESS);
          } else if (pid > 0) { // parent process
            Logger::error(DEBUG, {
              { MSG, "child forked" },
              { VAR_NAME, "pid" },
              { VAR_VALUE, std::to_string(pid) }
            });
          } else {
            throw Error(OSERR, "fork: " + std::string(std::strerror(errno)), errno);
          }
        } catch (const Error& err) {
          // TODO EAGAIN can be thrown by fork and we don't want it to be handled in the if part:
          if (err._errno == EAGAIN || err._errno == EWOULDBLOCK || err._errno == EINTR) {
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
