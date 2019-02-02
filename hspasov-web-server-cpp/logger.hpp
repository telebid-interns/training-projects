#ifndef LOGGER_HPP
#define LOGGER_HPP

#include "rapidjson/document.h"
#include "err_log_lvl.hpp"
#include "config.hpp"
#include "web_server_utils.hpp"
#include <set>
#include <map>
#include <string>
#include <list>
#include <unistd.h>
#include <cstdlib>
#include <execinfo.h>
#include <fcntl.h>

struct access_log_fields {
  std::string remote_addr;
  std::string req_line;
  std::string user_agent;
  std::string status_code;
  std::string content_length;
};

struct error_log_fields {
  const err_log_lvl level;
  std::string var_name;
  std::string var_value;
  std::string msg;
};

class Logger {
  protected:
    static int access_log_fd;
    static std::map<const err_log_lvl, const std::string> err_log_lvl_str;
    static std::set<std::string> selected_error_log_fields;
    static std::set<std::string> selected_access_log_fields;
  public:

    static void init_logger () {
      const std::list<std::string> allowed_error_log_fields{
          "pid",
          "timestamp",
          "level",
          "context",
          "var_name",
          "var_value",
          "msg",
        };

      const std::list<std::string> allowed_access_log_fields{
        "pid",
        "timestamp",
        "remote_addr",
        "req_line",
        "user_agent",
        "status_code",
        "content_length",
      };

      for (
        auto it = Config::config["error_log_fields"].GetArray().Begin();
        it != Config::config["error_log_fields"].GetArray().End();
        ++it) {

        Logger::selected_error_log_fields.insert(it->GetString());
      }

      for (
        auto it = Config::config["access_log_fields"].GetArray().Begin();
        it != Config::config["access_log_fields"].GetArray().End();
        ++it) {

        Logger::selected_access_log_fields.insert(it->GetString());
      }
    }

    static void init_access_log () {
      Logger::access_log_fd = open(Config::config["access_log"].GetString(), O_WRONLY | O_CREAT | O_APPEND | O_CLOEXEC, 0);

      if (Logger::access_log_fd < 0) {
        Logger::error(ERROR, {{ "msg", "open: " + std::string(std::strerror(errno)) }});
      }
    }

    static void close_access_log () {
      if (close(Logger::access_log_fd) < 0) {
        Logger::error(ERROR, {{ "msg", "close: " + std::string(std::strerror(errno)) }});
      }

      Logger::access_log_fd = -1;
    }

    static void error (const err_log_lvl level, const std::map<std::string, std::string>& fields) {
      // TODO check if invalid field option is passed
      if (level <= Config::config["error_log_level"].GetInt()) {
        std::list<const std::string> fields_list;

        if (Logger::selected_error_log_fields.find("pid") != Logger::selected_error_log_fields.end()) {
          fields_list.emplace_back(std::to_string(getpid()));
        }

        if (Logger::selected_error_log_fields.find("timestamp") != Logger::selected_error_log_fields.end()) {
          fields_list.emplace_back(web_server_utils::get_current_time());
        }

        if (Logger::selected_error_log_fields.find("level") != Logger::selected_error_log_fields.end()) {
          fields_list.emplace_back(Logger::err_log_lvl_str[level]);
        }

        if (Logger::selected_error_log_fields.find("context") != Logger::selected_error_log_fields.end()) {
          void* backtrace_points[2];
          const int entries = backtrace(static_cast<void**>(backtrace_points), 2);
          char** const backtrace_readables = backtrace_symbols(static_cast<void *const *>(backtrace_points), entries);

          // 0 is current function, 1 is caller function
          std::string result(backtrace_readables[1]);

          free(backtrace_readables);

          fields_list.emplace_back(result);
        }

        if (Logger::selected_error_log_fields.find("var_name") != Logger::selected_error_log_fields.end()) {
          if (fields.find("var_name") != fields.end()) {
            fields_list.emplace_back(fields.at("var_name"));
          } else {
            fields_list.emplace_back(Config::config["error_log_empty_field"].GetString());
          }
        }

        if (Logger::selected_error_log_fields.find("var_value") != Logger::selected_error_log_fields.end()) {
          if (fields.find("var_value") != fields.end()) {
            fields_list.emplace_back(fields.at("var_value"));
          } else {
            fields_list.emplace_back(Config::config["error_log_empty_field"].GetString());
          }
        }

        if (Logger::selected_error_log_fields.find("msg") != Logger::selected_error_log_fields.end()) {
          if (fields.find("msg") != fields.end()) {
            fields_list.emplace_back(fields.at("msg"));
          } else {
            fields_list.emplace_back(Config::config["error_log_empty_field"].GetString());
          }
        }

        for (auto it = fields_list.begin(); it != fields_list.end(); ++it) {
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
          Logger::error(ERROR, {{ "msg", "Attempt to write in uninitialized access log file" }});
        } else {
          std::list<const std::string> fields_list;

          if (Logger::selected_access_log_fields.find("pid") != Logger::selected_access_log_fields.end()) {
            fields_list.emplace_back(std::to_string(getpid()));
          }

          if (Logger::selected_access_log_fields.find("timestamp") != Logger::selected_access_log_fields.end()) {
            fields_list.emplace_back(web_server_utils::get_current_time());
          }

          if (Logger::selected_access_log_fields.find("remote_addr") != Logger::selected_access_log_fields.end()) {
            if (!fields.remote_addr.empty()) {
              fields_list.emplace_back(fields.remote_addr);
            } else {
              fields_list.emplace_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.find("req_line") != Logger::selected_access_log_fields.end()) {
            if (!fields.req_line.empty()) {
              fields_list.emplace_back(fields.req_line);
            } else {
              fields_list.emplace_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.find("user_agent") != Logger::selected_access_log_fields.end()) {
            if (!fields.user_agent.empty()) {
              fields_list.emplace_back(fields.user_agent);
            } else {
              fields_list.emplace_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.find("status_code") != Logger::selected_access_log_fields.end()) {
            if (!fields.status_code.empty()) {
              fields_list.emplace_back(fields.status_code);
            } else {
              fields_list.emplace_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          if (Logger::selected_access_log_fields.find("content_length") != Logger::selected_access_log_fields.end()) {
            if (!fields.content_length.empty()) {
              fields_list.emplace_back(fields.content_length);
            } else {
              fields_list.emplace_back(Config::config["access_log_empty_field"].GetString());
            }
          }

          std::string access_log_row;

          for (auto it = fields_list.begin(); it != fields_list.end(); ++it) {
            if (it != fields_list.begin()) {
              access_log_row.append(Config::config["error_log_field_sep"].GetString());
            }

            access_log_row.append(*it);
          }

          access_log_row.append("\n");

          Logger::text_file_write(Logger::access_log_fd, access_log_row);
        }
      }
    }

    static void text_file_write (const int fd, const std::string& content) {
      unsigned total_amount_bytes_written = 0;

      while (total_amount_bytes_written < content.size()) {
        const std::string content_to_write = content.substr(total_amount_bytes_written, Config::config["access_log_write_buffer"].GetInt());
        const int bytes_written_amount = write(fd, content_to_write.c_str(), content_to_write.size());

        if (bytes_written_amount < 0) {
          throw Error(OSERR, "write: " + std::string(std::strerror(errno)));
        }

        total_amount_bytes_written += bytes_written_amount;
      }
    }
};

#endif
