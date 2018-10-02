import configparser
import logging.config
import os

DEV_CONF = './conf.d/config.ini'


config = configparser.ConfigParser()
config.read(os.environ.get('WS_CONFIG_FILE', DEV_CONF))


# TODO have a basic config in case this function fails ?
def configure_logging():
    logging.config.fileConfig(config['logging']['config_file'])
