#ifndef WEB_SERVER_UTILS_HH
#define WEB_SERVER_UTILS_HH

#include <string>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <iostream>
#include <vector>

namespace web_server_utils {

  std::string read_text_file (const char* const);
  void text_file_write (const int, const std::string);
  bool is_fd_open (const int);
  std::string get_current_time ();
  std::vector<std::string> split (const std::string, const std::string);
  std::string to_upper (const std::string);
  std::string trim (const std::string);

}

#endif
