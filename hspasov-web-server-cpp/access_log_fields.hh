#ifndef ACCESS_LOG_FIELDS_HH
#define ACCESS_LOG_FIELDS_HH

#include <string>

struct access_log_fields {
  const std::string req_line;
  const std::string user_agent;
  const std::string status_code;
  const std::string content_length;
};

#endif
