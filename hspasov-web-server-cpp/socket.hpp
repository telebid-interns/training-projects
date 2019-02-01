#ifndef SOCKET_HPP
#define SOCKET_HPP

#include <cerrno>
#include <iostream>
#include <unistd.h>
#include <sys/socket.h>
#include "config.hpp"
#include "error.hpp"
#include "logger.hpp"

class Socket {
  protected:
    const int _fd;

  public:
    char* const recv_buffer;
    char* const send_buffer;
    ssize_t bytes_received_amount;

    Socket (const int fd)
      : _fd(fd),
        recv_buffer(new char[Config::config["recv_buffer"].GetInt()]),
        send_buffer(new char[Config::config["send_buffer"].GetInt()]),
        bytes_received_amount(0) {}

    ~Socket () {
      delete this->recv_buffer;
      delete this->send_buffer;

      if (close(this->_fd) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "close: " + std::string(std::strerror(errno));
        Logger::error(fields);
      }
    }

    void shutdown () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      if (::shutdown(this->_fd, SHUT_RDWR) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "shutdown: " + std::string(std::strerror(errno));
        Logger::error(fields);

        throw Error(OSERR, "shutdown: " + std::string(std::strerror(errno)));
        // TODO improve error handling
      }
    }

    void send (const std::string data) {
      const int no_flags = 0;
      unsigned total_bytes_sent = 0;

      std::string remaining_data(data);

      while (total_bytes_sent < data.size()) {
        std::string data_to_send(remaining_data, 0, Config::config["send_buffer"].GetInt());

        data_to_send.copy(this->send_buffer, data_to_send.size(), 0);

        ssize_t bytes_sent = ::send(this->_fd, this->send_buffer, data_to_send.size(), no_flags);

        if (bytes_sent < 0) {
          // TODO handle case
          throw Error(OSERR, "send: " + std::string(std::strerror(errno)));
        } else if (bytes_sent == 0) {
          error_log_fields fields = { DEBUG };
          fields.msg = "0 bytes sent after calling send";
          Logger::error(fields);
        }

        total_bytes_sent += bytes_sent;
        remaining_data.erase(0, bytes_sent);
      }

      error_log_fields fields = { DEBUG };
      fields.msg = "successfully sent " + std::to_string(total_bytes_sent);
      fields.var_name = "data";
      fields.var_value = data;
      Logger::error(fields);
    }

    void receive () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      const int no_flags = 0;

      this->bytes_received_amount = recv(this->_fd, this->recv_buffer, Config::config["recv_buffer"].GetInt(), no_flags);

      if (this->bytes_received_amount < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "recv: " + std::string(std::strerror(errno));
        Logger::error(fields);

        throw Error(OSERR, "recv: " + std::string(std::strerror(errno)));
      }
    }
};

#endif
