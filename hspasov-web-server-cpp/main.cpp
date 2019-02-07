#include "server.hpp"
#include "config.hpp"
#include "logger.hpp"
#include "web_server_utils.hpp"
#include "rapidjson/document.h"
#include <curl/curl.h>
#include <iostream>

rapidjson::Document Config::config;
int Logger::access_log_fd = -1;
std::set<std::string> Logger::selected_error_log_fields;
std::set<std::string> Logger::selected_access_log_fields;
std::map<const err_log_lvl, const std::string> Logger::err_log_lvl_str = {
  { ERROR, "ERROR" },
  { INFO, "INFO" },
  { WARNING, "WARNING" },
  { DEBUG, "DEBUG" },
};

int main (int argc, char** argv) {
  assert(argc == 2);

  try {
    Config::init_config(std::string(argv[1]));
    Logger::init_logger();
  } catch (const Error& err) {
    if (err._type == SERVERERR) {
      std::cerr << err._msg << std::endl;
      return -1;
    }

    throw;
  }

  try {
    Server server = Server();
    server.run();
  } catch (const Error& err) {
    Logger::error(ERROR, {{ MSG, err._msg }});
    return -1;
  }

  return 0;
}
