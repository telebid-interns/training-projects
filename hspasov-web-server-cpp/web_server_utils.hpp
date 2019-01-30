#ifndef WEB_SERVER_UTILS_HPP
#define WEB_SERVER_UTILS_HPP

#include <string>
#include <regex>
#include <vector>
#include <cerrno>
#include <ctime>
#include <cstring>
#include <iostream>
#include <unistd.h>
#include <fcntl.h>
#include <sys/time.h>
#include "error.hpp"

namespace web_server_utils {

  inline std::string read_text_file (const char* const file_path) {
    // TODO add file size limit assert

    const int fd = open(file_path, O_RDONLY);

    if (fd < 0) {
      throw Error(DEBUG, "open: " + errno);
    }

    std::string file_content;

    while (true) {
      const int buff_size = 10;
      char buffer[buff_size];
      const ssize_t bytes_read_amount = read(fd, buffer, buff_size);

      if (bytes_read_amount == 0) {
        break;
      } else if (bytes_read_amount < 0) {
        throw Error(DEBUG, "read: " + errno);
      } else {
        file_content.append(buffer, bytes_read_amount);
      }
    }

    if (close(fd) < 0) {
      throw Error(DEBUG, "close: " + errno);
    }

    return file_content;
  }

  inline void text_file_write (const int fd, const std::string content) {
    // TODO put buff size in config
    const int buff_size = 1024;
    unsigned total_amount_bytes_written = 0;
    std::string content_to_write(content);

    while (total_amount_bytes_written < content.length()) {
      const std::string content_to_write = content.substr(total_amount_bytes_written, buff_size);
      const int bytes_written_amount = write(fd, content_to_write.c_str(), content_to_write.length());

      if (bytes_written_amount < 0) {
        throw Error(ERROR, "write: " + errno);
      }

      total_amount_bytes_written += bytes_written_amount;
    }
  }

  inline bool is_fd_open (const int fd) {
    return fcntl(fd, F_GETFD) != -1 || errno != EBADF;
  }

  inline std::string get_current_time () {
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

  inline std::vector<std::string> split(std::string str, std::regex delimiter_pattern) {
    std::vector<std::string> result;

    std::regex_token_iterator<std::string::iterator> token_iter(str.begin(), str.end(), delimiter_pattern, -1);
    std::regex_token_iterator<std::string::iterator> end;

    while (token_iter != end) {
      result.push_back(*token_iter);
      token_iter++;
    }

    return result;
  }

  inline std::string ascii_letters_to_upper (const std::string str) {
    const int ascci_letter_case_diff = 'a' - 'A';
    std::string result;

    for (std::string::const_iterator it = str.begin(); it != str.end(); it++) {
      if (*it >= 'a' && *it <= 'z') {
        result += *it - ascci_letter_case_diff;
      } else {
        result += *it;
      }
    }

    return result;
  }

  inline std::string trim (const std::string str) {
    const std::regex left_whitespace_pattern("^\\s*");
    const std::regex right_whitespace_pattern("\\s*$");

    std::string left_trimmed = std::regex_replace(str, left_whitespace_pattern, "");

    return std::regex_replace(left_trimmed, right_whitespace_pattern, "");
  }

}

#endif
