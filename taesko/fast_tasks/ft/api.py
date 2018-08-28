import json
import logging
import pkgutil
import importlib

from flask import Blueprint, request

import ft.tasks
from ft.err import assertPeer, assertUser
from ft.validate import validate_uri_query, validate_request_body


API = Blueprint('api', __name__)


logger = logging.getLogger(__name__)

@API.before_request()
def validate_resources():
    method = request.method
    path = request.path
    validate_uri_query(method, path, dict(request.args))
    validate_request_body(method, path, dict(request.get_json(cache=True)))


@API.route('/tasks/')
def tasks():
    no_sub_packages = all(is_pkg is False for _, _, is_pkg in pkgutil.iter_modules(ft.tasks))
    assert no_sub_packages, 'tasks package has a sub package inside it.'
    tasks = [name for _, name, _ in pkgutil.iter_modules(ft.tasks)]

    return dict(tasks=tasks)


@API.route('/tasks/<task_name>', method=['POST'])
def process_task_input(task_name):
    raw_input = request.form['arguments']

    parsed = json.loads(raw_input, encoding='utf-8')

    # TODO validate input

    module = importlib.import_module('.'.join(['ft', 'tasks', task_name]))

    result = module.execute(**parsed)

    return json.dumps(result)


