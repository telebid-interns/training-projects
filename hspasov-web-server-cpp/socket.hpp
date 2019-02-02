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
    int _fd;

    void destroy () {
      delete[] this->recv_buffer;
      delete[] this->send_buffer;

      if (close(this->_fd) < 0) {
        Logger::error(ERROR, {{ "msg", "close: " + std::string(std::strerror(errno)) }});
      }
    }

  public:
    char* const recv_buffer;
    char* const send_buffer;
    ssize_t bytes_received_amount;

    explicit Socket (const int fd)
      : _fd(fd),
        recv_buffer(new char[Config::config["recv_buffer"].GetInt()]),
        send_buffer(new char[Config::config["send_buffer"].GetInt()]),
        bytes_received_amount(0) {

      timeval recv_timeout;
      recv_timeout.tv_sec = Config::config["socket_recv_timeout"].GetInt();
      recv_timeout.tv_usec = 0;

      if (setsockopt(this->_fd, SOL_SOCKET, SO_RCVTIMEO, &recv_timeout, sizeof(recv_timeout)) < 0) {
        this->destroy();

        throw Error(OSERR, "setsockopt: " + std::string(std::strerror(errno)));
      }

      timeval send_timeout;
      send_timeout.tv_sec = Config::config["socket_send_timeout"].GetInt();
      send_timeout.tv_usec = 0;

      if (setsockopt(this->_fd, SOL_SOCKET, SO_SNDTIMEO, &send_timeout, sizeof(send_timeout)) < 0) {
        this->destroy();

        throw Error(OSERR, "setsockopt: " + std::string(std::strerror(errno)));
      }
    }

    Socket (const Socket& socket)
      : recv_buffer(new char[Config::config["recv_buffer"].GetInt()]),
        send_buffer(new char[Config::config["send_buffer"].GetInt()]),
        bytes_received_amount(socket.bytes_received_amount) {

      this->_fd = fcntl(socket._fd, F_DUPFD_CLOEXEC, 0);

      if (this->_fd < 0) {
        this->destroy();

        throw Error(OSERR, "fcntl: " + std::string(std::strerror(errno)));
      }

      for (int i = 0; i < Config::config["recv_buffer"].GetInt(); i++) {
        this->recv_buffer[i] = socket.recv_buffer[i];
      }

      for (int i = 0; i < Config::config["send_buffer"].GetInt(); i++) {
        this->send_buffer[i] = socket.send_buffer[i];
      }
    }

    ~Socket () {
      this->destroy();
    }

    Socket& operator= (const Socket& socket) {
      int new_fd = fcntl(socket._fd, F_DUPFD_CLOEXEC, 0);

      if (new_fd < 0) {
        throw Error(OSERR, "fcntl: " + std::string(std::strerror(errno)));
      }

      if (close(this->_fd) < 0) {
        Logger::error(ERROR, {{ "msg", "close: " + std::string(std::strerror(errno)) }});
      }

      this->_fd = new_fd;
      this->bytes_received_amount = socket.bytes_received_amount;

      for (int i = 0; i < Config::config["recv_buffer"].GetInt(); i++) {
        this->recv_buffer[i] = socket.recv_buffer[i];
      }

      for (int i = 0; i < Config::config["send_buffer"].GetInt(); i++) {
        this->send_buffer[i] = socket.send_buffer[i];
      }

      return *this;
    }

    void shutdown () {
      Logger::error(DEBUG, {});

      if (::shutdown(this->_fd, SHUT_RDWR) < 0) {
        std::string err_msg = "shutdown: " + std::string(std::strerror(errno));

        if (errno == ENOTCONN) {
          throw Error(CLIENTERR, err_msg);
        } else {
          // TODO avoid duplicate logging
          Logger::error(ERROR, {{ "msg", err_msg }});

          throw Error(OSERR, err_msg);
        }
      }
    }

    void send (const std::string& data) {
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
        }

        if (bytes_sent == 0) {
          Logger::error(DEBUG, {{ "msg", "0 bytes sent after calling send" }});
        }

        total_bytes_sent += bytes_sent;
        remaining_data.erase(0, bytes_sent);
      }

      Logger::error(DEBUG, {
        { "var_name", "data" },
        { "var_value", data },
        { "msg", "successfully sent " + std::to_string(total_bytes_sent) }
      });
    }

    void receive () {
      Logger::error(DEBUG, {});

      const int no_flags = 0;

      this->bytes_received_amount = recv(this->_fd, this->recv_buffer, Config::config["recv_buffer"].GetInt(), no_flags);

      if (this->bytes_received_amount < 0) {
        Logger::error(ERROR, {{ "msg", "recv: " + std::string(std::strerror(errno)) }});

        throw Error(OSERR, "recv: " + std::string(std::strerror(errno)));
      }
    }
};

#endif
