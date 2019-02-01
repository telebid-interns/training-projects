#ifndef HTTP_MSG_FORMATTER_HPP
#define HTTP_MSG_FORMATTER_HPP

#include <string>
#include <map>
#include <regex>
#include <vector>
#include "web_server_utils.hpp"
#include "logger.hpp"
#include "err_log_lvl.hpp"
#include "error.hpp"

enum http_method {
  GET,
};

struct request_meta {
  std::string req_line_raw;
  http_method method;
  std::string target;
  std::string path;
  std::string query_string;
  std::string http_version;
  std::map<const std::string, const std::string> headers;
  std::string user_agent;
};

struct response_meta {
  std::map<std::string, std::string> headers;
  std::string status_code;
};

namespace http_msg_formatter {

  const std::map<const std::string, const http_method> http_method_from_str = {
    { "GET", GET },
  };

  const std::map<const int, const std::string> response_reason_phrases = {
    { 200, "OK" },
    { 400, "Bad Request" },
    { 404, "Not Found" },
    { 408, "Request Timeout" },
    { 500, "Internal Server Error" },
    { 502, "Bad Gateway" },
    { 503, "Service Unavailable" },
  };

  inline request_meta parse_req_meta (const std::string req_meta) {
    error_log_fields fields = { DEBUG };
    Logger::error(fields);

    const bool split_excl_empty_tokens = true;

    std::vector<std::string> req_meta_lines = web_server_utils::split(req_meta, std::regex("\\r\\n"), split_excl_empty_tokens);

    if (req_meta_lines.size() < 1) {
      throw Error(CLIENTERR, "Invalid request");
    }

    std::string req_line = req_meta_lines[0];

    const std::vector<std::string> req_line_split = web_server_utils::split(req_line, std::regex(" "), split_excl_empty_tokens);

    if (req_line_split.size() != 3) {
      throw Error(CLIENTERR, "Invalid request");
    }

    const std::string method = req_line_split[0];
    const std::string target = web_server_utils::url_unescape(req_line_split[1]);
    const std::string http_version = req_line_split[2];

    std::string query_string;
    std::vector<std::string> target_split = web_server_utils::split(target, std::regex("\\?"), split_excl_empty_tokens);

    if (target_split.size() == 1) {
      query_string = "";
    } else if (target_split.size() == 2) {
      query_string = target_split[1];
    } else {
      throw Error(CLIENTERR, "Invalid request");
    }

    const std::string path = target_split[0];

    std::map<const std::string, const std::string> headers;

    for (std::vector<std::string>::const_iterator it = req_meta_lines.begin() + 1; it != req_meta_lines.end(); it++) {
      const size_t field_sep_pos = (*it).find(":");

      if (field_sep_pos == std::string::npos) {
        throw Error(CLIENTERR, "Invalid request");
      }

      const std::string field_name = (*it).substr(0, field_sep_pos);

      if (field_name.size() != web_server_utils::trim(field_name).size()) {
        throw Error(CLIENTERR, "Invalid request");
      }

      const std::string field_value_raw = (*it).substr(field_sep_pos + 1);
      const std::string field_value = web_server_utils::trim(field_value_raw);

      headers.insert(std::pair<const std::string, const std::string>(field_name, field_value));
    }

    std::string user_agent = "";

    if (headers.find("User-Agent") != headers.end()) {
      user_agent = headers.at("User-Agent");
    }

    request_meta result;
    result.req_line_raw = req_line;
    result.method = http_method_from_str.at(method);
    result.target = target;
    result.path = path;
    result.query_string = query_string;
    result.http_version = http_version;
    result.headers = headers;
    result.user_agent = user_agent;

    return result;
  }

  inline std::string build_res_meta (int status_code, std::map<std::string, std::string> headers, std::string body = "") {
    std::string result;

    result += "HTTP/1.1 ";
    result += std::to_string(status_code);
    result += " ";
    result += response_reason_phrases.at(status_code);

    for (std::map<std::string, std::string>::iterator it = headers.begin(); it != headers.end(); it++) {
      result += "\r\n";
      result += it->first;
      result += ": ";
      result += it->second;
    }

    result += "\r\n\r\n";
    result += body;

    return result;
  }
}

#endif
