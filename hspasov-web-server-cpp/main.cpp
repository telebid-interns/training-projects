#include "server.hpp"
#include "config.hpp"
#include "logger.hpp"

#include "web_server_utils.hpp"
#include <curl/curl.h>
#include <iostream>

rapidjson::Document Config::config;

int main (int argc, char** argv) {
  assert(argc == 2);

  try {
    Config::init_config(std::string(argv[1]));
    Logger::init_logger();
  } catch (const Error& err) {
    if (err._type == SERVERERR) {
      std::cerr << err << std::endl;
      return -1;
    }

    throw;
  }

  Server server = Server();

  server.run();

  return 0;
}
