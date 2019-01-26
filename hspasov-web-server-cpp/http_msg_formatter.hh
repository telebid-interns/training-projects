#ifndef HTTP_MSG_FORMATTER_HH
#define HTTP_MSG_FORMATTER_HH

#include <string>
#include <map>

enum http_method {
  GET,
};

struct request_meta {
  std::string req_line_raw;
  http_method method;
  std::string target;
  std::string query_string;
  std::string http_version;
  std::map<const std::string, const std::string> headers;
  std::string user_agent;
};

struct response_meta {
  const std::map<const std::string, const std::string> headers;
  const std::string status_code;
};

namespace http_msg_formatter {
  request_meta parse_req_meta(const std::string);
  response_meta build_res_meta(const int, const std::map<const std::string, const std::string>, const std::string);
}

#endif
