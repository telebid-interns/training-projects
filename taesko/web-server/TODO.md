1. v3 **DEADLINE=2018-10-19**
2. Automatic tests/checks
    1. GET /status page
    2. Test worker timeouts, rate limiting on invalid requests.
    3. Test GET requests for binary files.
3. parser.parse and Worker.respond grow linearly with concurrency.
