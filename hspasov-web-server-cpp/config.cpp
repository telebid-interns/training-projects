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
  rapidjson::Document config_schema_document;

  std::string config_schema_raw = web_server_utils::read_text_file(config_file_schema_path.c_str());

  if (config_schema_document.Parse(config_schema_raw.c_str()).HasParseError()) {
    std::cerr << "JSON parsing error: " << std::endl; // TODO show where the error is
    exit(-1);
  }

  rapidjson::SchemaDocument config_schema(config_schema_document);
  rapidjson::SchemaValidator config_schema_validator(config_schema);

  std::string config_raw = web_server_utils::read_text_file(config_file);

  if (Config::config.Parse(config_raw.c_str()).HasParseError()) {
    std::cerr << "JSON parsing error: " << std::endl; // TODO show where the error is
    exit(-1);
  }

  if (!Config::config.Accept(config_schema_validator)) {
    std::cerr << "JSON validation error: " << std::endl; // TODO show where the errror is
  }
}
