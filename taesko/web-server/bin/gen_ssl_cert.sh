#!/bin/bash -e
openssl req -new -x509 -days 365 -nodes -out cert.pem -keyout cert.pem
