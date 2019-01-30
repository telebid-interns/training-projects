#ifndef CLIENT_CONNECTION_HPP
#define CLIENT_CONNECTION_HPP

#include "socket.hpp"
#include "client_conn_state.hpp"
#include <string>
#include "client_connection.hpp"
#include "logger.hpp"
#include "error_log_fields.hpp"
#include "config.hpp"
#include "http_msg_formatter.hpp"
#include <iostream>

class ClientConnection {
  private:
    Socket conn;
    client_conn_state state;
    std::string req_meta_raw;
  public:
    ClientConnection (const int conn)
      : conn(Socket(conn)), state(ESTABLISHED) {

    }
    // TODO later ~ClientConnection();

    // TODO check why Socket cant be passed by reference

    void receive_meta () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      this->state = RECEIVING;

      while (true) {
        if (this->req_meta_raw.length() > Config::config["req_meta_limit"].GetUint()) {
          // TODO send 400
          return;
        }

        error_log_fields fields = { DEBUG };
        fields.msg = "receiving data...";
        Logger::error(fields);

        this->conn.receive();

        this->req_meta_raw.append(this->conn.buffer, this->conn.bytes_received_amount);

        if (this->conn.bytes_received_amount == 0) {
          error_log_fields fields = { DEBUG };
          fields.msg = "connection closed by peer";
          Logger::error(fields);
          // TODO handle
        }

        size_t double_crlf_pos = this->req_meta_raw.find("\r\n\r\n");

        if (double_crlf_pos != std::string::npos) {
          error_log_fields fields = { DEBUG };
          fields.msg = "reached end of request meta";
          Logger::error(fields);

          std::string body_beg = this->req_meta_raw.substr(double_crlf_pos);
          body_beg.erase(0, 4); // remove CR-LF-CR-LF at the beginning
          strcpy(this->conn.buffer, body_beg.c_str());
          this->conn.bytes_received_amount = body_beg.length();

          this->req_meta_raw = this->req_meta_raw.substr(0, double_crlf_pos);

          break;
        }
      }

      fields.msg = this->req_meta_raw;
      Logger::error(fields);

      fields.msg = "Parsing request msg..";
      Logger::error(fields);

      request_meta req_meta = http_msg_formatter::parse_req_meta(this->req_meta_raw);

      std::cerr << "method: " << req_meta.method << std::endl;
      std::cerr << "target: " << req_meta.target << std::endl;
      std::cerr << "query_string: " << req_meta.query_string << std::endl;
      std::cerr << "http_version: " << req_meta.http_version << std::endl;
      std::cerr << "user agent: " << req_meta.user_agent << std::endl;
    }

    void send_meta();
    void serve_static_file();
};

#endif
