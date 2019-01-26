#include "error.hh"
#include <string>
#include <iostream>
#include "err_log_lvl.hh"
#include "error_log_fields.hh"
#include "logger.hh"

Error::Error(err_log_lvl lvl, std::string msg)
  : _msg(msg) {

  error_log_fields fields = { lvl };
  fields.msg = msg;
  Logger::error(fields);
}

std::ostream& Error::operator<<(std::ostream& out) {
  out << this->_msg;
  return out;
}
