#ifndef ERROR_HPP
#define ERROR_HPP

#include <iostream>
#include <string>

enum error_type {
  OSERR,
  CLIENTERR,
  SERVERERR,
  APPERR,
};

class Error: public std::exception {
  public:
    const std::string _msg;
    const error_type _type;

    Error(const error_type type, const std::string& msg)
      : _msg(msg), _type(type) {

      // TODO remove:
      std::cerr << msg << std::endl;
    }
};

#endif
