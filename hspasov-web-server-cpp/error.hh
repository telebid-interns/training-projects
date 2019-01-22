#ifndef ERROR_HH
#define ERROR_HH

#include <string>

class Error {
  private:
    std::string _msg;
  public:
    Error(std::string msg);
    std::ostream& operator<<(std::ostream& out);
};

#endif
