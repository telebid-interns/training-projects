### HTTP web server with non-blocking IO

#### Features
- Uses non-blocking IO with ```epoll```
- Implementation of HTTP 1.1 protocol
- Implementation of CGI/1.1 protocol 
- Support for HTTPS
- Access and error log
- Serve static files
- Run CGI scripts

## Usage
### Start server
1. Edit the parameters in config.json

2. Start the web server
```
$ python3 start.py /path/to/config.json
```
### Serve static files
1. Put files in the document root dir (path resolution starts from web server root)

2. Access them via web browser

**Example:**
https://127.0.0.1/index,html

### Run CGI scripts
1. Put CGI scripts in configured CGI dir (path resolution starts from web server root)

2. Run them via web browser

**Example:**
https://127.0.0.1/cgi-bin/test.py

## Technologies used:
Python 3

## Author
Hristo Spasov - hristo.b.spasov@gmail.com
