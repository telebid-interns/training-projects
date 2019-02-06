#ifndef FILE_READER_HPP
#define FILE_READER_HPP

#include "web_server_utils.hpp"
#include "error.hpp"
#include "logger.hpp"
#include "config.hpp"
#include <cerrno>
#include <sys/stat.h>
#include <fcntl.h>

class ContentReader {
  protected:
    int _fd;

    void destroy () {
      Logger::error(DEBUG, {});

      delete[] buffer;

      if (::close(this->_fd) < 0) {
        Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
      }
    }

  public:
    size_t file_size;
    char* const buffer;

    explicit ContentReader (const std::string& file_path)
      : buffer(new char[Config::config["read_buffer"].GetInt()]) {

      Logger::error(DEBUG, {});

      this->_fd = open(web_server_utils::resolve_static_file_path(file_path).c_str(), O_RDONLY | O_CLOEXEC, 0);

      if (this->_fd < 0) {
        std::string err_msg = "open: " + std::string(std::strerror(errno));

        if (errno == EISDIR || errno == ENOENT) {
          throw Error(CLIENTERR, err_msg);
        }

        throw Error(OSERR, err_msg);
      }

      struct stat statbuf = {};

      if (fstat(this->_fd, &statbuf) < 0) {
        this->destroy();
        throw Error(OSERR, "fstat: " + std::string(std::strerror(errno)));
      }

      // check whether it is not regular file
      if (!S_ISREG(statbuf.st_mode)) {
        this->destroy();
        throw Error(CLIENTERR, "requested file is not regular");
      }

      this->file_size = statbuf.st_size;
    }

    ContentReader (const ContentReader& reader)
      : buffer(new char[Config::config["read_buffer"].GetInt()]) {

      Logger::error(DEBUG, {});

      // read position is preserved
      this->_fd = fcntl(reader._fd, F_DUPFD_CLOEXEC, 0);

      if (this->_fd < 0) {
        this->destroy();

        throw Error(OSERR, "fcntl: " + std::string(std::strerror(errno)));
      }

      for (int i = 0; i < Config::config["read_buffer"].GetInt(); i++) {
        this->buffer[i] = reader.buffer[i];
      }

      this->file_size = reader.file_size;
    }

    ~ContentReader () {
      Logger::error(DEBUG, {});

      this->destroy();
    }

    ContentReader& operator= (const ContentReader& reader) {
      Logger::error(DEBUG, {});

      const int new_fd = fcntl(reader._fd, F_DUPFD_CLOEXEC, 0);

      if (new_fd < 0) {
        throw Error(OSERR, "fcntl: " + std::string(std::strerror(errno)));
      }

      if (close(this->_fd) < 0) {
        Logger::error(ERROR, {{ MSG, "close: " + std::string(std::strerror(errno)) }});
      }

      this->_fd = new_fd;
      this->file_size = reader.file_size;

      for (int i = 0; i < Config::config["read_buffer"].GetInt(); i++) {
        this->buffer[i] = reader.buffer[i];
      }

      return *this;
    }

    size_t read () {
      Logger::error(DEBUG, {});

      const ssize_t bytes_read = ::read(this->_fd, this->buffer, Config::config["read_buffer"].GetInt());

      if (bytes_read < 0) {
        throw Error(OSERR, "read: " + std::string(std::strerror(errno)));
      }

      return bytes_read;
    }
};

#endif
