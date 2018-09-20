import os
import json

import jsonschema

from pachu.err import assertSystem, PeerError
from pachu.config import config


protocol_formats = {
    'jsonrpc': 'json',
    'yamlrpc': 'yaml'
}
supported_protocols = list(protocol_formats.keys())

def compile_schemas_under_tree(dir_path):
    _, dnames, fnames = next(os.walk(dir_path))
    msg = 'directory {} contains both files and directories.'.format(fnames)

    assertSystem(not (fnames and dnames), msg=msg)

    if dnames:
        return {dn: compile_schemas_under_tree(dn) for dn in dnames}
    else:
        return {fn: json.loads(open(fn).read()) for fn in fnames}

compiled_schemas = compile_schemas_under_tree(
    config['resources']['schemas-tree']
)

def validate_request_through_protocol(requestBody, protocol):
    is_valid = jsonschema.validate(requestBody,
                                   compiled_schemas['requests'][protocol])

def validate_request_of_method(requestBody, method):
    try:
        jsonschema.validate(requestBody, compiled_schemas['requests'][method])
    except jsonschema.ValidationError:
        raise PeerError(code='BAD_METHOD_REQUEST')

