#ifndef FILE_READER_HPP
#define FILE_READER_HPP

#include <cerrno>
#include <sys/stat.h>
#include <fcntl.h>
#include "web_server_utils.hpp"
#include "error.hpp"
#include "logger.hpp"
#include "config.hpp"

class ContentReader {
  protected:
    int _fd;
    size_t size;

    void close () {
      if (::close(this->_fd) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "close: " + std::string(std::strerror(errno));
        Logger::error(fields);
      }
    }

  public:
    char* buffer;

    ContentReader (const std::string file_path) {
      this->buffer = new char[Config::config["read_buffer"].GetInt()];

      const int fd = open(web_server_utils::resolve_static_file_path(file_path).c_str(), O_RDONLY);

      if (fd < 0) {
        // TODO handle file does not exist, file is a directory...

        throw Error(ERROR, "open: " + std::string(std::strerror(errno)));
      }

      struct stat statbuf;

      if (fstat(fd, &statbuf) < 0) {
        // TODO check different errnos if necessary
        this->close();
        throw Error(ERROR, "fstat: " + std::string(std::strerror(errno)));
      }

      // check whether it is not regular file
      if (!S_ISREG(statbuf.st_mode)) {
        // TODO handle this case
        this->close();
        throw Error(DEBUG, "requested file is not regular");
      }

      this->_fd = fd;
      this->size = statbuf.st_size;
    }

    ~ContentReader () {
      this->close();
      delete buffer;
    }

    size_t file_size () {
      return this->size;
    }

    size_t read () {
      ssize_t bytes_read = ::read(this->_fd, this->buffer, Config::config["read_buffer"].GetInt());

      if (bytes_read < 0) {
        throw Error(ERROR, "read: " + std::string(std::strerror(errno)));
      }

      return bytes_read;
    }
};

#endif
