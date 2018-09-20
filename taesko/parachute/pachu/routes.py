from flask import request

from pachu import app
from pachu.config import config


@app.route(config['routes']['api'])
def api():
    body = request.get_json(force=True)
