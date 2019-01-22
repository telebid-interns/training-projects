#include "error.hh"
#include <string>

Error::Error(std::string msg)
  : _msg(msg) {}

std::ostream& Error::operator<<(std::ostream& out) {
  out << this->_msg;
  return out;
}
