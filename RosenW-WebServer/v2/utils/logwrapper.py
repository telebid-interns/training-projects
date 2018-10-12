import traceback
from logger import Logger

class LoggerWrapper(object):
    def __init__(self, opts):
        self.logger = Logger(opts)

    def log(self, level_str, s):
        try:
            self.logger.log(level_str, s)
        except Exception as e:
            try:
                traceback.print_exc()
            except:
                pass