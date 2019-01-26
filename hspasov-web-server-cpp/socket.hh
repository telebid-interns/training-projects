#ifndef SOCKET_HH
#define SOCKET_HH

#include <sys/socket.h>

class Socket {
  private:
    int fd;

  public:
    char* buffer;
    ssize_t bytes_received_amount;

    Socket(int);
    ~Socket();
    void shutdown();
    void send();
    void receive();
};

#endif
