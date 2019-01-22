#ifndef WEB_SERVER_UTILS_HH
#define WEB_SERVER_UTILS_HH

#include <string>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <iostream>

namespace web_server_utils {

  std::string read_text_file (const char* const file_path);
  bool is_fd_open (const int fd);

  std::string get_current_time ();
}

#endif
