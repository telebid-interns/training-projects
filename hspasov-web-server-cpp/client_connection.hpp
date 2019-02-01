#ifndef CLIENT_CONNECTION_HPP
#define CLIENT_CONNECTION_HPP

#include <string>
#include <iostream>
#include <sys/stat.h>
#include "socket.hpp"
#include "logger.hpp"
#include "config.hpp"
#include "http_msg_formatter.hpp"
#include "content_reader.hpp"

enum client_conn_state {
  ESTABLISHED,
  RECEIVING,
  SENDING,
  SHUTDOWN,
  CLOSED
};

class ClientConnection {
  protected:
    Socket conn;
    std::string req_meta_raw;
  public:
    request_meta req_meta;
    response_meta res_meta;
    client_conn_state state;

    ClientConnection (const int conn)
      : conn(Socket(conn)), state(ESTABLISHED) {

      Logger::init_access_log();
    }

    ~ClientConnection() {
      try {
        // TODO check if undefined:
        access_log_fields fields;
        fields.remote_addr = "NOT IMPL"; // TODO
        fields.req_line = this->req_meta.req_line_raw;
        fields.user_agent = this->req_meta.user_agent;
        fields.status_code = res_meta.status_code;
        fields.content_length = "NOT IMPL"; // TODO

        Logger::access(fields);
      } catch (Error err) {
        // TODO handle
        // TODO refactor this:
        err.operator<<(std::cerr) << std::endl;
      }

      Logger::close_access_log();
    }

    // TODO check why Socket cant be passed by reference

    void receive_meta () {
      error_log_fields fields = { DEBUG };
      Logger::error(fields);

      this->state = RECEIVING;

      while (true) {
        if (this->req_meta_raw.size() > Config::config["req_meta_limit"].GetUint()) {
          // TODO send 400
          return;
        }

        error_log_fields fields = { DEBUG };
        fields.msg = "receiving data...";
        Logger::error(fields);

        this->conn.receive();

        this->req_meta_raw.append(this->conn.recv_buffer, this->conn.bytes_received_amount);

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
          body_beg.copy(this->conn.recv_buffer, body_beg.size(), 0);
          this->conn.bytes_received_amount = body_beg.size();

          this->req_meta_raw = this->req_meta_raw.substr(0, double_crlf_pos);

          break;
        }
      }

      fields.msg = this->req_meta_raw;
      Logger::error(fields);

      fields.msg = "Parsing request msg..";
      Logger::error(fields);

      this->req_meta = http_msg_formatter::parse_req_meta(this->req_meta_raw);

      // TODO refactor this
      std::string req_meta_stringified = "method: ";
      req_meta_stringified += this->req_meta.method;
      req_meta_stringified += "; target: ";
      req_meta_stringified += this->req_meta.target;
      req_meta_stringified += "; path: ";
      req_meta_stringified += this->req_meta.path;
      req_meta_stringified += "; query_string: ";
      req_meta_stringified += this->req_meta.query_string;
      req_meta_stringified += "; http_version: ";
      req_meta_stringified += this->req_meta.http_version;
      req_meta_stringified += "; user agent: ";
      req_meta_stringified += this->req_meta.user_agent;

      fields.msg = req_meta_stringified;
      Logger::error(fields);
    }

    void serve_static_file (const std::string path) {
      // TODO add traces

      error_log_fields fields = { DEBUG };
      fields.var_name = "path";
      fields.var_value = web_server_utils::resolve_static_file_path(path).c_str();
      Logger::error(fields);

      ContentReader reader(path);

      // TODO add consts
      std::map<std::string, std::string> headers = {
        { "Content-Length", std::to_string(reader.file_size()) },
      };

      this->send_meta(200, headers);

      // TODO count packages sent

      while (true) {
        ssize_t bytes_read = reader.read();

          // TODO check if all fds are being properly closed on errors
        if (bytes_read == 0) {
          error_log_fields fields = { DEBUG };
          fields.msg = "end of file reached while reading";
          Logger::error(fields);

          break;
        }

        const std::string data(reader.buffer, bytes_read);

        // TODO maybe it is not a good idea to convert data from char* to std::string and then back to char*
        this->conn.send(data);
      }

      this->conn.shutdown();
    }

    void send_meta (int status_code, std::map<std::string, std::string> headers) {
      error_log_fields fields = { DEBUG };
      fields.var_name = "status_code";
      fields.var_value = status_code;
      Logger::error(fields);

      // TODO print headers
      // TODO assert status code valid

      this->state = SENDING;

      response_meta res_meta;
      res_meta.status_code = status_code;
      res_meta.headers = headers;

      this->res_meta = res_meta;

      std::string res_meta_msg = http_msg_formatter::build_res_meta(status_code, headers);

      this->conn.send(res_meta_msg);
    }
};

#endif
