#include <string>
#include "server.hh"
#include <iostream>
#include "config.hh"

int main (int argc, char** argv) {
  assert(argc == 2);

  Config::init_config(argv[1]);

  
  return 0;
}
