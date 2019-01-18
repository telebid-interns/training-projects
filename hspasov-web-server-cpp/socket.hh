#ifndef SOCKET_HH
#define SOCKET_HH

class Socket {
  private:
    int fd;

  public:
    Socket(int fd);
};

#endif
