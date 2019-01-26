#ifndef SOCKET_HH
#define SOCKET_HH

#include <sys/socket.h>

class Socket {
  private:
    const int _fd;

  public:
    char* buffer;
    ssize_t bytes_received_amount;

    Socket(const int);
    ~Socket();
    void shutdown();
    void send();
    void receive();
};

#endif
