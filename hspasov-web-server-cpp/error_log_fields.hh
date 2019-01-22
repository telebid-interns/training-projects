#ifndef ERROR_LOG_FIELDS_HH
#define ERROR_LOG_FIELDS_HH

#include <string>

struct error_log_fields {
  const int level;
  const std::string var_name;
  const std::string var_value;
  const std::string msg;
};

#endif
