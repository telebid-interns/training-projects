#ifndef ACCESS_LOG_FIELDS_HH
#define ACCESS_LOG_FIELDS_HH

#include <string>

struct access_log_fields {
  std::string remote_addr;
  std::string req_line;
  std::string user_agent;
  std::string status_code;
  std::string content_length;
};

#endif
