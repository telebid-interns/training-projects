#ifndef ACCESS_LOG_FIELDS_HPP
#define ACCESS_LOG_FIELDS_HPP

#include <string>

struct access_log_fields {
  std::string remote_addr;
  std::string req_line;
  std::string user_agent;
  std::string status_code;
  std::string content_length;
};

#endif
