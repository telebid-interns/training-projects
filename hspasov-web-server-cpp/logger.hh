#ifndef LOGGER_HH
#define LOGGER_HH

#include <map>
#include <string>
#include "access_log_fields.hh"
#include "error_log_fields.hh"
#include "err_log_lvl.hh"

class Logger {
  private:
    static int access_log_fd;
    static std::map<const err_log_lvl, const std::string> err_log_lvl_str;
    static std::map<const std::string, bool> selected_error_log_fields;
    static std::map<const std::string, bool> selected_access_log_fields;
  public:
    static void init_logger();
    static void init_access_log();
    static void close_access_log();
    static void error(const error_log_fields&);
    static void access(const access_log_fields&);
};

#endif
