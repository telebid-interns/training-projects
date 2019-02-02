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

    void destroy () {
      delete[] buffer;

      if (::close(this->_fd) < 0) {
        Logger::error(ERROR, {{ "msg", "close: " + std::string(std::strerror(errno)) }});
      }
    }

  public:
    char* const buffer;

    explicit ContentReader (const std::string& file_path)
      : buffer(new char[Config::config["read_buffer"].GetInt()]) {

      const int fd = open(web_server_utils::resolve_static_file_path(file_path).c_str(), O_RDONLY);

      if (fd < 0) {
        std::string err_msg = "open: " + std::string(std::strerror(errno));

        if (errno == EISDIR || errno == ENOENT) {
          throw Error(CLIENTERR, err_msg);
        }

        throw Error(OSERR, err_msg);
      }

      struct stat statbuf = {};

      if (fstat(fd, &statbuf) < 0) {
        this->destroy();
        throw Error(OSERR, "fstat: " + std::string(std::strerror(errno)));
      }

      // check whether it is not regular file
      if (!S_ISREG(statbuf.st_mode)) {
        this->destroy();
        throw Error(CLIENTERR, "requested file is not regular");
      }

      this->_fd = fd;
      this->size = statbuf.st_size;
    }

    ContentReader (const ContentReader& reader)
      : buffer(new char[Config::config["read_buffer"].GetInt()]) {

      // TODO check if read position is preserved
      this->_fd = fcntl(reader._fd, F_DUPFD_CLOEXEC, 0);

      if (this->_fd < 0) {
        this->destroy();

        throw Error(OSERR, "fcntl: " + std::string(std::strerror(errno)));
      }

      for (int i = 0; i < Config::config["read_buffer"].GetInt(); i++) {
        this->buffer[i] = reader.buffer[i];
      }

      this->size = reader.size;
    }

    ~ContentReader () {
      this->destroy();
    }

    size_t file_size () {
      return this->size;
    }

    ContentReader& operator= (const ContentReader& reader) {
      int new_fd = fcntl(reader._fd, F_DUPFD_CLOEXEC, 0);

      if (new_fd < 0) {
        throw Error(OSERR, "fcntl: " + std::string(std::strerror(errno)));
      }

      if (close(this->_fd) < 0) {
        Logger::error(ERROR, {{ "msg", "close: " + std::string(std::strerror(errno)) }});
      }

      this->_fd = new_fd;
      this->size = reader.size;

      for (int i = 0; i < Config::config["read_buffer"].GetInt(); i++) {
        this->buffer[i] = reader.buffer[i];
      }

      return *this;
    }

    size_t read () {
      ssize_t bytes_read = ::read(this->_fd, this->buffer, Config::config["read_buffer"].GetInt());

      if (bytes_read < 0) {
        throw Error(OSERR, "read: " + std::string(std::strerror(errno)));
      }

      return bytes_read;
    }
};

#endif
