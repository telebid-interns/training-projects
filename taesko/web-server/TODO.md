1. Automatic tests/checks
    1. Test worker timeouts, rate limiting on invalid requests.
    2. Test GET requests for binary files.
5. Refactor all usage of strings in HTTP structs to bytes.
7. Re-write ExcHandler to have handlers be it's methods.
8. CGI script has no timeout for writing to it's stdin - can block indefinitely.
9. Profile high cpu usage by disabling parsing and disabling serving from disk.
10. no lines are written to access.log when cgi is used.
