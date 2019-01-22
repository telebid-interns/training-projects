#ifndef CONFIG_HH
#define CONFIG_HH

#include "rapidjson/document.h"

class Config {
  public:
    static void init_config(const char* const);
    static rapidjson::Document config;
};

#endif
