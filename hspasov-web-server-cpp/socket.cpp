#include "socket.hh"
#include "config.hh"
#include "error.hh"
#include <cerrno>
#include "logger.hh"
#include "error_log_fields.hh"
#include <sys/socket.h>
#include <unistd.h>

Socket::Socket (int fd) {
  this->fd = fd;
  this->buffer = new char[Config::config["socket_buffer"].GetInt()];
  this->bytes_received_amount = 0;
}

Socket::~Socket () {
  delete[] this->buffer;

  if (close(this->fd) < 0) {
    error_log_fields fields = { ERROR };
    fields.msg = "close: " + errno;
    Logger::error(fields);

    throw Error("close: " + errno);
    // TODO handle different cases
  }
}

void Socket::shutdown () {
  error_log_fields fields = { DEBUG };
  Logger::error(fields);

  if (::shutdown(this->fd, SHUT_RDWR) < 0) {
    error_log_fields fields = { ERROR };
    fields.msg = "shutdown: " + errno;
    Logger::error(fields);

    throw Error("shutdown: " + errno);
    // TODO improve error handling
  }
}

void Socket::send () {

}

void Socket::receive () {
  error_log_fields fields = { DEBUG };
  Logger::error(fields);

  const int no_flags = 0;

  this->bytes_received_amount = recv(this->fd, &(this->buffer), Config::config["socket_buffer"].GetInt(), no_flags);

  if (this->bytes_received_amount < 0) {
    error_log_fields fields = { ERROR };
    fields.msg = "recv: " + errno;
    Logger::error(fields);

    throw Error("recv: " + errno);
  }
}
