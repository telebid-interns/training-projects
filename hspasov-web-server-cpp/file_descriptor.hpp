#ifndef FILE_DESCRIPTOR_HPP
#define FILE_DESCRIPTOR_HPP

#include "web_server_utils.hpp"
#include "logger.hpp"
#include "error.hpp"
#include <cerrno>

struct FileDescriptor {
  static const int uninitialized = -1;
  int _fd;

  explicit FileDescriptor (const int fd)
    : _fd(fd) {

    if (!web_server_utils::is_fd_open(fd)) {
      throw Error(APPERR, "initializing FileDescriptor with with closed or invalid file descriptor", errno);
    }
  }

  FileDescriptor ()
    : _fd(FileDescriptor::uninitialized) {}

  ~FileDescriptor () {
    if (this->_fd != FileDescriptor::uninitialized && close(this->_fd)) {
      Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
    }
  }

  // TODO refactor this:
  void assign_fd (const int fd) {
    if (!web_server_utils::is_fd_open(fd)) {
      throw Error(APPERR, "initializing FileDescriptor with with closed or invalid file descriptor", errno);
    }

    this->_fd = fd;
  }
};

#endif
