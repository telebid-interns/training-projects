import os
import configparser
import logging.config


DEV_CONF = './conf.d/config.ini'


config = configparser.ConfigParser()
config.read(os.environ.get('WS_CONFIG_FILE', DEV_CONF))


def configure_logging():
    logging.config.fileConfig(config['logging']['config_file'])
