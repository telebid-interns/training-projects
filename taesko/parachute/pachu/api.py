import collections
import functools
import logging

from flask import request, g, jsonify, Blueprint

from pachu.config import config
from pachu.protocol import normalize_request
from pachu.validation import validate_request_of_method
from pachu.err import PeerError, UserError
import pachu.exports


API = Blueprint('RPC_API', __name__)
stderr_logger = logging.getLogger('stderr')
api_req_logger = logging.getLogger('api_requests')
api_res_logger = logging.getLogger('api_responses')
rpc_api_methods = {}


def register_rpc_api_method(method_name):
    assert isinstance(method_name, str)

    def decorator(func):
        rpc_api_methods[method_name] = func

        return func

    return decorator


def log_request(method, params):
    extra = dict(
        remote_addr=request.remote_addr,
        url=request.url,
        method=method,
        params=params
    )
    api_req_logger.info(msg='', extra=extra)


@API.after_request
def log_response(response):
    extra = dict(
        remote_addr=request.remote_addr,
        url=request.url,
    )
    api_res_logger.info(msg='', extra=extra)

    return response


# TODO decorate API methods and hanlde user errors
@API.errorhandler(PeerError)
def peer_error_handler(error):
    stderr_logger.info('A peer error occurred with code=%s', error.code)
    api_codes = {
        'API_DIFFERENT_FORMATS': 4100,
        'API_UNSUPPORTED_FORMAT': 4101,
        'API_BAD_METHOD_PARAMS': 4200,

    }

    extra_payload = {}

    if error.user_msg:
        extra_payload['user_message'] = error.user_msg

    payload = dict(
        jsonrpc='2.0',
        id=0,  # TODO
        error=dict(
            code=api_codes[error.code],
            message=error.msg,
            payload=extra_payload
        )
    )
    response = jsonify(payload)
    response.status_code = 200

    return response


@API.errorhandler(UserError)
def user_error_handler(error):
    stderr_logger.info('An user error occurred with code=%s', error.code)
    api_codes = {
        'API_ECH_INVALID_CREDENTIALS': 2100,
        'API_ECH_EXCEEDED_TRANSFERRED_DELTA': 2105,
        'API_ECH_QUERY_TIMEOUT': 2106
    }

    extra_payload = {}

    if error.user_msg:
        extra_payload['user_message'] = error.user_msg

    payload = dict(
        jsonrpc='2.0',
        id=0,
        error=dict(
            code=api_codes[error.code],
            message=error.msg,
            payload=extra_payload
        )
    )
    response = jsonify(payload)
    response.status_code = 200

    return response


@API.route(config['routes']['api'], methods=['POST'])
def api():
    format_param_key = 'format'

    format_ = request.args.get(format_param_key, None)

    normalized = normalize_request(body=request.get_json(force=True),
                                   content_type=request.content_type,
                                   query_param=format_)

    log_request(method=normalized['method'], params=normalized['params'])

    validate_request_of_method(normalized['params'], normalized['method'])

    methods = {
        'export_credit_history': pachu.exports.export_credit_history,
    }

    response = methods[normalized['method']](g.cursor, **normalized['params'])

    return response


@register_rpc_api_method('export_credit_history')
def export_credit_history(
        cursor, *,
        column_names=None,
        filter_column_names=None,
        v,
        api_key,
        fly_from=None,
        fly_to=None,
        date_from=None,
        date_to=None,
        transferred_from=None,
        transferred_to=None,
        status=None,
        transfer_amount=None,
        transfer_amount_operator=None,
        group_by=None
):
    transferred_from = transferred_from or config[]
