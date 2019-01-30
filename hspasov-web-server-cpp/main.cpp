#include "server.hpp"
#include "config.hpp"
#include "logger.hpp"

#include "web_server_utils.hpp"
#include <curl/curl.h>

int main (int argc, char** argv) {
  assert(argc == 2);

  Config::init_config(argv[1]);
  Logger::init_logger();

  Server server = Server();

  server.run();

  return 0;
}
