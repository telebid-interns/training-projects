import logging

from flask import request, g

from pachu import app
from pachu.config import config
from pachu.protocol import normalize_request
from pachu.validation import validate_request_of_method
import pachu.exports


stderr_logger = logging.getLogger('stderr')


@app.route(config['routes']['api'])
def api():
    format_query_param = 'format'
    normalized = normalize_request(body=request.get_json(force=True),
                                   content_type=request.content_type,
                                   query_param=request.args[format_query_param])
    validate_request_of_method(normalized, normalized.method)

    methods = {
        'export_credit_history': pachu.exports.export_credit_history,
    }

    return methods[normalized.method]

