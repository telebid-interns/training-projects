#ifndef CLIENT_CONNECTION_HPP
#define CLIENT_CONNECTION_HPP

#include "config.hpp"
#include "content_reader.hpp"
#include "http_msg_formatter.hpp"
#include "logger.hpp"
#include "socket.hpp"
#include <iostream>
#include <string>
#include <sys/stat.h>

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
    const std::string remote_addr;
    const unsigned short remote_port;
    request_meta req_meta;
    response_meta res_meta;
    client_conn_state state;

    explicit ClientConnection (const int conn, const std::string& addr, const unsigned short port)
      : conn(Socket(conn)), remote_addr(addr), remote_port(port), state(ESTABLISHED) {

      Logger::init_access_log();
    }

    ~ClientConnection() {
      try {
        access_log_fields fields = {};
        fields.remote_addr = this->remote_addr;
        fields.req_line = this->req_meta.req_line_raw;
        fields.user_agent = this->req_meta.user_agent;
        fields.status_code = this->res_meta.status_code;

        if (this->res_meta.headers.find("Content-Length") != this->res_meta.headers.end()) {
          fields.content_length = this->res_meta.headers.at("Content-Length");
        }

        Logger::access(fields);
      } catch (const Error& err) {
        Logger::error(ERROR, {{ MSG, err._msg }});
      }

      Logger::close_access_log();
    }

    // TODO(hristo): check why Socket cant be passed by reference

    void receive_meta () {
      Logger::error(DEBUG, {});

      this->state = RECEIVING;

      while (true) {
        if (this->req_meta_raw.size() > Config::config["req_meta_limit"].GetUint()) {
          this->send_meta(400, std::map<std::string, std::string>());
          return;
        }

        Logger::error(DEBUG, {{ MSG, "receiving data..." }});

        // TODO(hristo): add timeout
        this->conn.receive();

        this->req_meta_raw.append(this->conn.recv_buffer, this->conn.bytes_received_amount);

        if (this->conn.bytes_received_amount == 0) {
          Logger::error(DEBUG, {{ MSG, "connection closed by peer" }});

          this->state = CLOSED;
          return;
        }

        const size_t double_crlf_pos = this->req_meta_raw.find("\r\n\r\n", 0);

        if (double_crlf_pos != std::string::npos) {
          Logger::error(DEBUG, {{ MSG, "reached end of request meta" }});

          std::string body_beg = this->req_meta_raw.substr(double_crlf_pos, std::string::npos);
          body_beg.erase(0, 4); // remove CR-LF-CR-LF at the beginning
          body_beg.copy(this->conn.recv_buffer, body_beg.size(), 0);
          this->conn.bytes_received_amount = body_beg.size();

          this->req_meta_raw = this->req_meta_raw.substr(0, double_crlf_pos);

          break;
        }
      }

      Logger::error(DEBUG, {{ MSG, this->req_meta_raw }});
      Logger::error(DEBUG, {{ MSG, "Parsing request msg.." }});

      try {
        this->req_meta = http_msg_formatter::parse_req_meta(this->req_meta_raw);
      } catch (const Error& err) {
        this->send_meta(400, std::map<std::string, std::string>());
        return;
      }

      // TODO(hristo): refactor this
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

      Logger::error(DEBUG, {{ MSG, req_meta_stringified }});
    }

    void serve_static_file (const std::string& path) {
      // TODO(hristo): add traces

      Logger::error(DEBUG, {
        { VAR_NAME, "path" },
        { VAR_VALUE, web_server_utils::resolve_static_file_path(path) }
      });

      try {
        ContentReader reader(path);

        // TODO(hristo): add consts
        std::map<std::string, std::string> headers;
        headers.insert(std::pair<std::string, std::string>("Content-Length", std::to_string(reader.file_size)));

        this->send_meta(200, headers);

        while (true) {
          const ssize_t bytes_read = reader.read();

            // TODO(hristo): check if all fds are being properly closed on errors
          if (bytes_read == 0) {
            Logger::error(DEBUG, {{ MSG, "end of file reached while reading" }});

            break;
          }

          const std::string data(reader.buffer, bytes_read);

          // TODO(hristo): maybe it is not a good idea to convert data from char* to std::string and then back to char*
          const int packages_sent = this->conn.send(data);

          this->res_meta.packages_sent += packages_sent;
        }
      } catch (const Error& err) {
        // TODO(hristo): refactor error handling
        if (err._type == CLIENTERR) {
          this->send_meta(404, std::map<std::string, std::string>());
          return;
        }

        throw;
      }
    }

    void send_meta (const int status_code, const std::map<std::string, std::string>& headers) {
      Logger::error(DEBUG, {
        { VAR_NAME, "status_code" },
        { VAR_VALUE, std::to_string(status_code) }
      });

      // TODO(hristo): print headers
      assert(http_msg_formatter::response_reason_phrases.find(status_code) != http_msg_formatter::response_reason_phrases.end());

      this->state = SENDING;

      response_meta res_meta = {};
      res_meta.status_code = std::to_string(status_code);
      res_meta.headers = headers;
      res_meta.packages_sent = 0;

      this->res_meta = res_meta;

      std::string res_meta_msg = http_msg_formatter::build_res_meta(status_code, headers, "");

      const int packages_sent = this->conn.send(res_meta_msg);

      this->res_meta.packages_sent += packages_sent;
    }

    void shutdown () {
      this->conn.shutdown();
    }
};

#endif
