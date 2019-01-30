#ifndef ERROR_HPP
#define ERROR_HPP

#include <string>
#include <iostream>
#include "err_log_lvl.hpp"

enum error_type {
  OSERR // TODO add more
};

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
