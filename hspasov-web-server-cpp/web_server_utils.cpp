#include <string>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <ctime>
#include <iostream>
#include <sys/time.h>

namespace web_server_utils {

  std::string read_text_file (const char* const file_path) {
    // TODO add file size limit assert

    int fd = open(file_path, O_RDONLY);

    if (fd < 0) {
      std::cout << "open errno: " << errno << std::endl;
      exit(-1);
    }

    std::string file_content;

    while (true) {
      const int buff_size = 10;
      char buffer[buff_size];
      ssize_t bytes_read_amount = read(fd, buffer, buff_size);

      if (bytes_read_amount == 0) {
        break;
      } else if (bytes_read_amount < 0) {
        std::cout << "read errno: " << errno << std::endl;
        exit(-1);
      } else {
        file_content.append(buffer, bytes_read_amount);
      }
    }

    if (close(fd) < 0) {
      std::cout << "close errno: " << errno << std::endl;
    }

    return file_content;
  }

  bool is_fd_open (const int fd) {
    return fcntl(fd, F_GETFD) != -1 || errno != EBADF;
  }

  std::string get_current_time () {
    const int time_str_max_chars = 20;
    char time_str[time_str_max_chars];
    timeval time;

    gettimeofday(&time, nullptr);

    tm* timeinfo = std::localtime(&time.tv_sec);
    strftime(time_str, time_str_max_chars, "%Y-%m-%d %H:%M:%S", timeinfo);

    std::string result_str(time_str);
    result_str.append(".");
    result_str.append(std::to_string(time.tv_usec));

    return result_str;
  }

}
