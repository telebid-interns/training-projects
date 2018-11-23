import traceback
import json
import os
from config import CONFIG
from log import log, TRACE, DEBUG, INFO
from worker import Worker


class Server:
    def __init__(self):
        log.error(TRACE)

    def run(self):
        log.error(TRACE)

        pid = None

        while True:
            try:

                pid = os.fork()

                if pid == 0:  # child process
                    log.init_access_log_file()

                    worker = Worker()
                    worker.start()  # event loop
                else:  # parent process
                    log.error(DEBUG, msg='New child created with pid {0}'.format(pid))  # noqa
                    os.wait()

            except OSError as error:
                log.error(TRACE, msg='OSError')
                log.error(TRACE, msg=error)
            finally:
                if pid is not None and pid == 0:
                    log.close_access_log_file()


def start():
    log.error(TRACE)

    server = Server()

    try:
        server.run()
    except OSError as error:
        log.error(TRACE, msg='OSError thrown while initializing web server')
        log.error(INFO, msg=error)
    except AssertionError as error:
        log.error(TRACE, msg='AssertionError thrown')
        log.error(INFO, msg=str(error) + str(traceback.format_exc()))
    except Exception as error:
        log.error(TRACE, msg='Exception thrown')
        log.error(INFO, msg=str(error) + str(traceback.format_exc()))


if __name__ == '__main__':
    try:
        log.error(DEBUG, var_name='config', var_value=CONFIG)

        start()
    except OSError as error:
        log.error(INFO, msg=error)
    except json.JSONDecodeError as error:
        log.error(INFO,
                  msg='error while parsing config file: {0}'.format(error))
