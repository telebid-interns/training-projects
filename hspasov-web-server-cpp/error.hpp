#ifndef ERROR_HPP
#define ERROR_HPP

#include "err_log_lvl.hpp"
#include <string>
#include <iostream>
#include "error_log_fields.hpp"

class Error {
  protected:
    std::string _msg;
  public:
    Error(err_log_lvl lvl, std::string msg)
      : _msg(msg) {

      // TODO remove:
      std::cerr << msg << std::endl;
    }

    std::ostream& operator<<(std::ostream& out) {
      out << this->_msg;
      return out;
    }
};

#endif
