#ifndef WEB_SERVER_UTILS_HH
#define WEB_SERVER_UTILS_HH

#include <string>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <iostream>

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

}

#endif
