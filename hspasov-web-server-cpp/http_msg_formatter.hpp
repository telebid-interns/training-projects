#ifndef HTTP_MSG_FORMATTER_HPP
#define HTTP_MSG_FORMATTER_HPP

#include <string>
#include <map>
#include <regex>
#include <vector>
#include "web_server_utils.hpp"
#include "logger.hpp"
#include "err_log_lvl.hpp"

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

std::map<const std::string, const http_method> http_method_from_str = {
  { "GET", GET },
};

namespace http_msg_formatter {

  inline request_meta parse_req_meta (const std::string req_meta) {
    error_log_fields fields = { DEBUG };
    Logger::error(fields);

    size_t first_crlf_pos = req_meta.find("\r\n");

    if (first_crlf_pos == std::string::npos) {
      // TODO handle
      // return;
    }

    std::string req_line = req_meta.substr(0, first_crlf_pos);

    const std::vector<std::string> req_line_split = web_server_utils::split(req_line, std::regex(" "));

    if (req_line_split.size() != 3) {
      // TODO handle
      // return;
    }

    const std::string method = req_line_split[0];
    const std::string target = req_line_split[1];
    const std::string http_version = req_line_split[2];

    std::string query_string = "";
    const size_t query_params_pos = target.find("?");

    if (query_params_pos != std::string::npos) {
      query_string = target.substr(query_params_pos + 1);
    }

    std::string headers_str = req_meta.substr(first_crlf_pos);
    const int crlf_length = 2;
    headers_str.erase(0, crlf_length);

    const std::vector<std::string> headers_split = web_server_utils::split(headers_str, std::regex("\r\n"));

    std::map<const std::string, const std::string> headers;

    for (std::vector<std::string>::const_iterator it = headers_split.begin(); it != headers_split.end(); it++) {
      const size_t field_sep_pos = (*it).find(":");

      if (field_sep_pos == std::string::npos) {
        // TODO handle
        // return;
      }

      const std::string field_name = (*it).substr(0, field_sep_pos);

      if (field_name.length() != web_server_utils::trim(field_name).length()) {
        // TODO handle
        // return;
      }

      const std::string field_value = web_server_utils::trim((*it).substr(field_sep_pos + 1));

      headers.insert(std::pair<const std::string, const std::string>(field_name, field_value));
    }

    std::string user_agent = "";

    if (headers.find("User-Agent") != headers.end()) {
      user_agent = headers["User-Agent"];
    }

    request_meta result;
    result.req_line_raw = req_line;
    result.method = http_method_from_str[method];
    result.target = target;
    result.query_string = query_string;
    result.http_version = http_version;
    result.headers = headers;
    result.user_agent = user_agent;

    return result;
  }

  // inline response_meta build_res_meta (const int status_code, const std::map<const std::string, const std::string> headers, const std::string body) {

  //}
}

#endif
