#ifndef LOGGER_HPP
#define LOGGER_HPP

#include <map>
#include <string>
#include "access_log_fields.hpp"
#include "error_log_fields.hpp"
#include "err_log_lvl.hpp"
#include <list>
#include <unistd.h>
#include <stdlib.h>
#include <execinfo.h>
#include <fcntl.h>
#include "rapidjson/document.h"
#include "logger.hpp"
#include "config.hpp"
#include "web_server_utils.hpp"
#include "error.hpp"

class Logger {
  private:
    static int access_log_fd;
    static std::map<const err_log_lvl, const std::string> err_log_lvl_str;
    static std::map<const std::string, bool> selected_error_log_fields;
    static std::map<const std::string, bool> selected_access_log_fields;
  public:

    static void init_logger () {
      const std::list<std::string> allowed_error_log_fields = {
          "pid",
          "timestamp",
          "level",
          "context",
          "var_name",
          "var_value",
          "msg",
        };

      const std::list<std::string> allowed_access_log_fields = {
        "pid",
        "timestamp",
        "remote_addr",
        "req_line",
        "user_agent",
        "status_code",
        "content_length"
      };

      for (
        std::list<std::string>::const_iterator it = allowed_error_log_fields.begin();
        it != allowed_error_log_fields.end();
        ++it) {

        selected_error_log_fields[*it] = false;
      }

      for (
        std::list<std::string>::const_iterator it = allowed_access_log_fields.begin();
        it != allowed_access_log_fields.end();
        ++it) {

        selected_access_log_fields[*it] = false;
      }

      for (
        rapidjson::Value::ConstValueIterator it = Config::config["error_log_fields"].GetArray().Begin();
        it != Config::config["error_log_fields"].GetArray().End();
        ++it) {

        Logger::selected_error_log_fields[it->GetString()] = true;
      }

      for (
        rapidjson::Value::ConstValueIterator it = Config::config["access_log_fields"].GetArray().Begin();
        it != Config::config["access_log_fields"].GetArray().End();
        ++it) {

        Logger::selected_access_log_fields[it->GetString()] = true;
      }
    }

    static void init_access_log () {
      Logger::access_log_fd = open(Config::config["access_log"].GetString(), O_WRONLY | O_CREAT | O_APPEND);

      if (Logger::access_log_fd < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "open errno: " + errno;
        Logger::error(fields);

        std::cerr << "open: " << errno << std::endl;
      }
    }

    static void close_access_log () {
      if (close(Logger::access_log_fd) < 0) {
        error_log_fields fields = { ERROR };
        fields.msg = "close errno: " + errno;
        Logger::error(fields);

        std::cerr << "close: " << errno << std::endl;
      }

      Logger::access_log_fd = -1;
    }

    static void error (const error_log_fields& fields) {
      if (fields.level <= Config::config["error_log_level"].GetInt()) {
        std::list<const std::string> fields_list;

        if (Logger::selected_error_log_fields.at("pid")) {
          fields_list.push_back(std::to_string(getpid()));
        }

        if (Logger::selected_error_log_fields.at("timestamp")) {
          fields_list.push_back(web_server_utils::get_current_time());
        }

        if (Logger::selected_error_log_fields.at("level")) {
          fields_list.push_back(Logger::err_log_lvl_str[fields.level]);
        }

        if (Logger::selected_error_log_fields.at("context")) {
          void* backtrace_points[2];
          const int entries = backtrace(backtrace_points, 2);
          char** const backtrace_readables = backtrace_symbols(backtrace_points, entries);

          // 0 is current function, 1 is caller function
          std::string result(backtrace_readables[1]);

          free(backtrace_readables);

          fields_list.push_back(result);
        }

        if (Logger::selected_error_log_fields.at("var_name")) {
          if (fields.var_name.length() > 0) {
            fields_list.push_back(fields.var_name);
          } else {
            fields_list.push_back(Config::config["error_log_empty_field"].GetString());
          }
        }

        if (Logger::selected_error_log_fields.at("var_value")) {
          if (fields.var_value.length() > 0) {
            fields_list.push_back(fields.var_value);
          } else {
            fields_list.push_back(Config::config["error_log_empty_field"].GetString());
          }
        }

        if (Logger::selected_error_log_fields.at("msg")) {
          if (fields.msg.length() > 0) {
            fields_list.push_back(fields.msg);
          } else {
            fields_list.push_back(Config::config["error_log_empty_field"].GetString());
          }
        }

        for (
          std::list<const std::string>::iterator it = fields_list.begin();
          it != fields_list.end();
          ++it) {

          if (it != fields_list.begin()) {
            std::cerr << Config::config["error_log_field_sep"].GetString();
          }

          std::cerr << *it;
        }

        std::cerr << std::endl;
      }
    }

    static void access (const access_log_fields& fields) {
      if (Config::config["access_log_enabled"].GetBool()) {
        if (!web_server_utils::is_fd_open(Logger::access_log_fd)) {
          struct error_log_fields f = { ERROR };
          f.msg = "Attempt to write in uninitialized access log file";
          Logger::error(f);

          std::cerr << "Attempt to write in uninitialized access log file" << std::endl;
        } else {
          std::list<const std::string> fields_list;

          if (Logger::selected_access_log_fields.at("pid")) {
            fields_list.push_back(std::to_string(getpid()));
          }

          if (Logger::selected_access_log_fields.at("timestamp")) {
            fields_list.push_back(web_server_utils::get_current_time());
          }

          if (Logger::selected_access_log_fields.at("remote_addr")) {
            if (fields.remote_addr.length() > 0) {
              fields_list.push_back(fields.remote_addr);
            } else {
              fields_list.push_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.at("req_line")) {
            if (fields.req_line.length() > 0) {
              fields_list.push_back(fields.req_line);
            } else {
              fields_list.push_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.at("user_agent")) {
            if (fields.user_agent.length() > 0) {
              fields_list.push_back(fields.user_agent);
            } else {
              fields_list.push_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.at("status_code")) {
            if (fields.status_code.length() > 0) {
              fields_list.push_back(fields.status_code);
            } else {
              fields_list.push_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.at("content_length")) {
            if (fields.content_length.length() > 0) {
              fields_list.push_back(fields.content_length);
            } else {
              fields_list.push_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          std::string access_log_row;

          for (
            std::list<const std::string>::iterator it = fields_list.begin();
            it != fields_list.end();
            ++it) {

            if (it != fields_list.begin()) {
              access_log_row.append(Config::config["error_log_field_sep"].GetString());
            }

            access_log_row.append(*it);
          }

          access_log_row.append("\n");

          web_server_utils::text_file_write(Logger::access_log_fd, access_log_row);
        }
      }
    }
};

int Logger::access_log_fd = -1;
std::map<const std::string, bool> Logger::selected_error_log_fields;
std::map<const std::string, bool> Logger::selected_access_log_fields;
std::map<const err_log_lvl, const std::string> Logger::err_log_lvl_str = {
  { ERROR, "ERROR" },
  { INFO, "INFO" },
  { WARNING, "WARNING" },
  { DEBUG, "DEBUG" },
};

#endif
