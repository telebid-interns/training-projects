#ifndef LOGGER_HH
#define LOGGER_HH

#include "access_log_fields.hh"
#include "error_log_fields.hh"

class Logger {
  private:
    static int access_log_fd;
  public:
    static void init_access_log();
    static void close_access_log();
    static void error(const struct error_log_fields* const);
    static void access(const struct access_log_fields* const);
};

#endif
