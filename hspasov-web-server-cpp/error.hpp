#ifndef ERROR_HPP
#define ERROR_HPP

#include "err_log_lvl.hpp"
#include <string>
#include "error.hpp"
#include <iostream>
#include "error_log_fields.hpp"
// #include "logger.hpp"

class Error {
  private:
    std::string _msg;
  public:
    Error(err_log_lvl lvl, std::string msg)
      : _msg(msg) {

      error_log_fields fields = { lvl };
      fields.msg = msg;
      // Logger::error(fields);
    }

    std::ostream& operator<<(std::ostream& out) {
      out << this->_msg;
      return out;
    }
};

#endif
