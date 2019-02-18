#ifndef FILE_DESCRIPTOR_HPP
#define FILE_DESCRIPTOR_HPP

#include "web_server_utils.hpp"
#include "logger.hpp"
#include "error.hpp"
#include <cerrno>

struct FileDescriptor {
  static constexpr int uninitialized = -1;
  int _fd;

  explicit FileDescriptor (const int fd) {
    if (!web_server_utils::is_fd_open(fd)) {
      throw Error(APPERR, "initializing FileDescriptor with with closed or invalid file descriptor", errno);
    }

    this->_fd = fd;
  }

  FileDescriptor ()
    : _fd(FileDescriptor::uninitialized) {}

  FileDescriptor (FileDescriptor&& other) {
    this->_fd = other._fd;
    other._fd = FileDescriptor::uninitialized;
  }

  FileDescriptor& operator= (FileDescriptor&& other) {
    this->_fd = other._fd;
    other._fd = FileDescriptor::uninitialized;

    return *this;
  }

  FileDescriptor (const FileDescriptor&) = delete;
  FileDescriptor& operator= (const FileDescriptor&) = delete;

  ~FileDescriptor () {
    if (this->_fd != FileDescriptor::uninitialized && close(this->_fd) < 0) {
      Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
    }
  }
};

#endif
