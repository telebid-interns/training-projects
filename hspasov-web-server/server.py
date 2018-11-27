import traceback
import json
import os
import socket
from config import CONFIG
from log import log, TRACE, DEBUG, INFO
from worker import Worker


class Server:
    def __init__(self):
        log.error(TRACE)
        self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._accept_lock_fd = open('accept_lock', 'w')

    def run(self):
        log.error(TRACE)

        is_initialized = False
        pid = None

        self._socket.bind((CONFIG['host'], CONFIG['port']))
        log.error(TRACE, msg='socket bound: {0}:{1}'.format(CONFIG['host'],
                                                            CONFIG['port']))

        self._socket.listen(CONFIG['backlog'])
        log.error(TRACE,
                  msg='listening... backlog: {0}'.format(CONFIG['backlog']))

        while True:
            try:
                i = 0
                while ((is_initialized and i < 1) or
                       (not is_initialized and i < CONFIG['workers'])):
                    i += 1

                    pid = os.fork()

                    if pid == 0:  # child proces8s
                        try:
                            log.init_access_log_file()

                            worker = Worker(self._socket, self._accept_lock_fd)
                            worker.start()  # event loop
                        except Exception as error:
                            log.error(INFO, msg=error)
                        finally:
                            os._exit(os.EX_SOFTWARE)
                    else:  # parent process
                        log.error(DEBUG, msg='New child created with pid {0}'.format(pid))  # noqa
                os.wait()

                is_initialized = True

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
