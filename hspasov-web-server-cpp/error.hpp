#ifndef ERROR_HPP
#define ERROR_HPP

#include <string>
#include <iostream>

enum error_type {
  OSERR,
  CLIENTERR,
  SERVERERR,
  APPERR,
};

class Error {
  protected:
    const std::string _msg;
  public:
    const error_type _type;

    Error(error_type type, std::string msg)
      : _msg(msg), _type(type) {

      // TODO remove:
      std::cerr << msg << std::endl;
    }

    std::ostream& operator<<(std::ostream& out) const {
      out << this->_msg;
      return out;
    }
};

#endif
