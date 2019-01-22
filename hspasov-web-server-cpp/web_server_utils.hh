#ifndef WEB_SERVER_UTILS_HH
#define WEB_SERVER_UTILS_HH

#include <string>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <iostream>

namespace web_server_utils {

  std::string read_text_file (const char* const);
  void text_file_write (const int, const std::string);
  bool is_fd_open (const int);
  std::string get_current_time ();
}

#endif
