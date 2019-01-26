#ifndef ERROR_HH
#define ERROR_HH

#include "err_log_lvl.hh"
#include <string>

class Error {
  private:
    std::string _msg;
  public:
    Error(err_log_lvl, std::string msg);
    std::ostream& operator<<(std::ostream& out);
};

#endif
