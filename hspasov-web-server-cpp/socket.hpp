#ifndef SOCKET_HPP
#define SOCKET_HPP

#include <sys/socket.h>
#include "socket.hpp"
#include "config.hpp"
#include "error.hpp"
#include <cerrno>
#include "logger.hpp"
#include "error_log_fields.hpp"
#include <unistd.h>
#include <iostream>

class Socket {
  private:
    const int _fd;

  public:
    char* const buffer;
    ssize_t bytes_received_amount;

    Socket (const int fd)
      : _fd(fd),
        buffer(new char[Config::config["socket_buffer"].GetInt()]),
        bytes_received_amount(0) {}

    ~Socket () {
      std::cerr << "deallocated" << std::endl;
      delete this->buffer;

      if (close(this->_fd) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "close: " + errno;
        Logger::error(fields);
      }
    }

    void shutdown () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      if (::shutdown(this->_fd, SHUT_RDWR) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "shutdown: " + errno;
        Logger::error(fields);

        throw Error(DEBUG, "shutdown: " + errno);
        // TODO improve error handling
      }
    }

    void send () {
    // TODO
    }

    void receive () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      const int no_flags = 0;

      this->bytes_received_amount = recv(this->_fd, this->buffer, Config::config["socket_buffer"].GetInt(), no_flags);

      if (this->bytes_received_amount < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "recv: " + errno;
        Logger::error(fields);

        throw Error(DEBUG, "recv: " + errno);
      }
    }
};

#endif
