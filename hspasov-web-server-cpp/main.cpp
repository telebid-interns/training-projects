#include <unistd.h>
#include <stdlib.h>
#include <assert.h>
#include <fcntl.h>
#include <string>
#include <cerrno>
#include "server.hh"
#include "rapidjson/document.h"
#include <iostream>

int main (int argc, char** argv) {
  assert(argc == 2);

  int config_fd = open(argv[1], O_RDONLY);

  if (config_fd < 0) {
    std::cout << "open errno:" << errno << std::endl;
    exit(-1);
  }

  std::string config_raw_acc;

  while (true) {
    const int buff_size = 10;
    char buffer[buff_size];
    ssize_t bytes_read_amount = read(config_fd, buffer, buff_size);

    if (bytes_read_amount == 0) {
      break;
    } else if (bytes_read_amount < 0) {
      std::cout << "read errno: " << errno << std::endl;
      exit(-1);
    } else {
      config_raw_acc.append(buffer, bytes_read_amount);
    }
  }

  std::cout << "Here is config file raw:" << std::endl;
  std::cout << config_raw_acc << std::endl;

  if (close(config_fd) < 0) {
    std::cout << "close errno:" << errno << std::endl;
  }

  const char* config_raw = config_raw_acc.c_str();

  rapidjson::Document document;

  document.Parse(config_raw);

  std::cout << "the backlog:" << std::endl;
  std::cout << document["backlog"].GetInt() << std::endl;

  return 0;
}
