#ifndef ERROR_LOG_FIELDS_HH
#define ERROR_LOG_FIELDS_HH

#include <string>
#include "err_log_lvl.hh"

struct error_log_fields {
  const err_log_lvl level;
  std::string var_name;
  std::string var_value;
  std::string msg;
};

#endif
