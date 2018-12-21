import os
from log import log, DEBUG
from config import CONFIG


def resolve_static_file_path(path):
    log.error(DEBUG, msg='resolve_static_file_path')
    log.error(DEBUG, var_name='path', var_value=path)

    resolved_path = os.path.realpath(os.path.join(CONFIG['document_root'],
                                                  *path.split('/')[1:]))

    log.error(DEBUG, var_name='resolved_path', var_value=resolved_path)

    return resolved_path
