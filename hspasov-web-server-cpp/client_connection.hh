#ifndef CLIENT_CONNECTION_HH
#define CLIENT_CONNECTION_HH

class ClientConnection {
  private:
    int fd;
  public:
    ClientConnection();
    ~ClientConnection();
    void receive_meta();
    void receive();
    void send_meta();
    void send();
    void serve_static_file();
};

#endif
