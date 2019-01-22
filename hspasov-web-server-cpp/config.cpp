#include <cassert>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include "rapidjson/document.h"
#include "rapidjson/schema.h"
#include <iostream>
#include "config.hh"
#include "web_server_utils.hh"

// TODO maybe it should not be global like this
// TODO add minimum and maximum for config parameters
// TODO check if host config option can also be ip addr
rapidjson::Document Config::config;

void Config::init_config (const char* const config_file) {
  const std::string config_file_schema_path = "./config_schema.json";

  std::string config_raw = web_server_utils::read_text_file(config_file);
  std::string config_schema_raw = web_server_utils::read_text_file(config_file_schema_path.c_str());

  std::cout << "Here is config file raw:" << std::endl;
  std::cout << config_raw << std::endl;

  std::cout << "Here is config schema file raw:" << std::endl;
  std::cout << config_schema_raw << std::endl;

  Config::config.Parse(config_raw.c_str());

  std::cout << "the backlog:" << std::endl;
  std::cout << Config::config["backlog"].GetInt() << std::endl;
}
