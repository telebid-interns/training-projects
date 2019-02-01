#ifndef CONFIG_HPP
#define CONFIG_HPP

#include <iostream>
#include <cerrno>
#include <fcntl.h>
#include <unistd.h>
#include "rapidjson/document.h"
#include "rapidjson/schema.h"
#include "rapidjson/stringbuffer.h"
#include "error.hpp"

// TODO check if host config option can also be ip addr

class Config {
  public:
    static rapidjson::Document config;

    static void init_config (const std::string config_file) {
      const std::string config_file_schema_path = "./config_schema.json";
      rapidjson::Document config_schema_document;

      const std::string config_schema_raw = Config::read_config_file(config_file_schema_path);

      if (config_schema_document.Parse(config_schema_raw.c_str()).HasParseError()) {
        std::cerr << config_file_schema_path << ": JSON parsing error" << std::endl;
        exit(-1);
      }

      const rapidjson::SchemaDocument config_schema(config_schema_document);
      rapidjson::SchemaValidator config_schema_validator(config_schema);

      const std::string config_raw = Config::read_config_file(config_file);

      if (Config::config.Parse(config_raw.c_str()).HasParseError()) {
        std::cerr << config_file << ": JSON parsing error" << std::endl;
        exit(-1);
      }

      if (!Config::config.Accept(config_schema_validator)) {
        std::cerr << "config validation error: " << Config::get_validation_error(&config_schema_validator) << std::endl;
        exit(-1);
      }
    }

    static std::string read_config_file (const std::string file_path) {
      // TODO add file size limit assert

      const int fd = open(file_path.c_str(), O_RDONLY);

      if (fd < 0) {
        if (errno == ENOENT) {
          throw Error(SERVERERR, file_path + ": file not found");
        } else {
          throw Error(OSERR, "open: " + std::string(std::strerror(errno)));
        }
      }

      std::string file_content;

      while (true) {
        const int buff_size = 10;
        char buffer[buff_size];
        const ssize_t bytes_read_amount = read(fd, buffer, buff_size);

        if (bytes_read_amount == 0) {
          break;
        } else if (bytes_read_amount < 0) {
          throw Error(OSERR, "read: " + std::string(std::strerror(errno)));
        } else {
          file_content.append(buffer, bytes_read_amount);
        }
      }

      if (close(fd) < 0) {
        throw Error(OSERR, "close: " + std::string(std::strerror(errno)));
      }

      return file_content;
    }

    static std::string get_validation_error (rapidjson::SchemaValidator* validator) {
      std::string result;
      rapidjson::StringBuffer buffer;

      validator->GetInvalidSchemaPointer().StringifyUriFragment(buffer);

      result += buffer.GetString();
      result += "/";
      result += validator->GetInvalidSchemaKeyword();

      buffer.Clear();
      return result;
    }
};

// TODO maybe it should not be global like this
rapidjson::Document Config::config;

#endif
