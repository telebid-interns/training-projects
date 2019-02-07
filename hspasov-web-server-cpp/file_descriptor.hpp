#ifndef FILE_DESCRIPTOR_HPP
#define FILE_DESCRIPTOR_HPP

#include "logger.hpp"

struct FileDescriptor {
  int _fd;

  // TODO assert it is open fd
  explicit FileDescriptor (const int fd)
    : _fd(fd) {}

  FileDescriptor ()
    : _fd(-1) {}

  ~FileDescriptor () {
    if (close(this->_fd)) {
      Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
    }
  }

  // TODO refactor this:
  void assign_fd (const int fd) {
    this->_fd = fd;
  }
};

#endif
