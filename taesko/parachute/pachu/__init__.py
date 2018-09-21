import logging.config

from flask import Flask, g

from pachu.config import config
import pachu.db

logging.config.fileConfig(config['resources']['log_config_file'])
stdout_logger = logging.getLogger('stdout')
stderr_logger = logging.getLogger('stderr')
app = Flask(__name__)


@app.errorhandler(Exception)
def handle_error(e):
    g.exception_occurred = True
    stderr_logger.critical('Unhandled exception.', exc_info=e)


app.before_request(pachu.db.connect)
app.after_request(pachu.db.disconnect)

import pachu.routes
