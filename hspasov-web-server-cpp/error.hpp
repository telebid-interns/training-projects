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
    int _errno;

    Error(const error_type type, const std::string& msg, const int e = 0)
      : _msg(msg), _type(type), _errno(e) {}
};

#endif
