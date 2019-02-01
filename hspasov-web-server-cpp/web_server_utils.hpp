#ifndef WEB_SERVER_UTILS_HPP
#define WEB_SERVER_UTILS_HPP

#include <string>
#include <regex>
#include <vector>
#include <cerrno>
#include <curl/curl.h>
#include "error.hpp"
#include "config.hpp"

namespace web_server_utils {

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

  inline std::vector<std::string> split(std::string str, std::regex delimiter_pattern, bool excl_empty_tokens = false) {
    if (!excl_empty_tokens) {
      throw Error(DEBUG, "incl empty tokens NOT IMPLEMENTED");
    }

    std::vector<std::string> result;

    std::regex_token_iterator<std::string::iterator> token_iter(str.begin(), str.end(), delimiter_pattern, -1);
    std::regex_token_iterator<std::string::iterator> end;

    while (token_iter != end) {
      if ((*token_iter).length() > 0) {
        result.push_back(*token_iter);
      }

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
    const std::regex leading_whitespace_pattern("^\\s*");
    const std::regex trailing_whitespace_pattern("\\s*$");

    std::string leading_trimmed = std::regex_replace(str, leading_whitespace_pattern, "");

    return std::regex_replace(leading_trimmed, trailing_whitespace_pattern, "");
  }

  // TODO check for memory leaks
  inline std::string url_unescape (const std::string str) {
    CURL *handle = curl_easy_init();

    int unescaped_length;
    char* unescaped_raw = curl_easy_unescape(handle, str.c_str(), str.size(), &unescaped_length);

    std::string unescaped(unescaped_raw, unescaped_length);

    curl_free(unescaped_raw);
    curl_easy_cleanup(handle);

    return unescaped;
  }

  inline std::string join (const std::vector<std::string> tokens, const std::string separator) {
    std::string result;

    for (std::vector<std::string>::const_iterator it = tokens.begin(); it != tokens.end(); it++) {
      if (it != tokens.begin()) {
        result += separator;
      }

      result += *it;
    }

    return result;
  }

  inline std::string resolve_static_file_path (const std::string path) {
    const bool split_excl_empty_tokens = true;
    const std::regex forw_slash_regex("/");
    const std::vector<std::string> root_path_split = web_server_utils::split(
      Config::config["web_server_root"].GetString(),
      forw_slash_regex,
      split_excl_empty_tokens
    );
    const std::vector<std::string> document_root_path_split = web_server_utils::split (
      Config::config["document_root"].GetString(),
      forw_slash_regex,
      split_excl_empty_tokens
    );
    const std::vector<std::string> path_split = web_server_utils::split(path, forw_slash_regex, split_excl_empty_tokens);

    std::string result;

    std::vector<std::string> resolved_split;
    resolved_split.insert(resolved_split.end(), root_path_split.begin(), root_path_split.end());
    resolved_split.insert(resolved_split.end(), document_root_path_split.begin(), document_root_path_split.end());
    resolved_split.insert(resolved_split.end(), path_split.begin(), path_split.end());

    result.append("/");
    result.append(web_server_utils::join(resolved_split, "/"));

    return result;
  }

}

#endif
