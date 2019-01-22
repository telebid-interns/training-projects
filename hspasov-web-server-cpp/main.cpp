#include <string>
#include "server.hh"
#include <iostream>
#include "config.hh"
#include "logger.hh"
#include "error_log_fields.hh"

int main (int argc, char** argv) {
  assert(argc == 2);

  Config::init_config(argv[1]);
  Logger::init_logger();

  error_log_fields f = { ERROR };
  f.msg = "Test";

  Logger::error(f);

  return 0;
}
