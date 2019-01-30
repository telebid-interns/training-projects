#ifndef ERROR_LOG_FIELDS_HPP
#define ERROR_LOG_FIELDS_HPP

#include <string>
#include "err_log_lvl.hpp"

struct error_log_fields {
  const err_log_lvl level;
  std::string var_name;
  std::string var_value;
  std::string msg;
};

#endif
