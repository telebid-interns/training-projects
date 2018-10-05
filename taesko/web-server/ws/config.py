import configparser
import logging.config
import os

from ws.err import *

DEV_CONF = './conf.d/config.ini'


config = configparser.ConfigParser()
config_file = os.environ.get('WS_CONFIG_FILE', DEV_CONF)
assert_system(os.path.isfile(config_file), code='BAD_CONFIG_FILE',
              msg='Config file {} does not exist '
                  'or is a directory'.format(config_file))
config.read(config_file)

mode = config.get('settings', 'mode', fallback='production')
production_mode = 'production'
development_mode = 'dev'

assert_system(mode in (production_mode, development_mode),
              msg='Invalid settings.mode variable. Must be one of {}'.format(
               ''.join((production_mode, development_mode))
           ),
              code='CFG_BAD_SETTINGS_MODE')


# TODO have a basic config in case this function fails ?
def configure_logging():
    logging.config.fileConfig(config['logging']['config_file'])

    if mode == production_mode:
        logging.getLogger('error').info('Disabling logs in production mode.')
        logging.raiseExceptions = False
