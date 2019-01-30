#include <string>
#include "server.hpp"
#include <iostream>
#include "config.hpp"
#include "logger.hpp"
#include "error_log_fields.hpp"

int main (int argc, char** argv) {
  assert(argc == 2);

  Config::init_config(argv[1]);
  Logger::init_logger();

  error_log_fields f = { ERROR };
  f.msg = "Test";

  Logger::error(f);

  Server server = Server();

  server.run();

  return 0;
}
