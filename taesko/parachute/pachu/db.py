import logging

from flask import g
import psycopg2
import psycopg2.extras

from pachu.config import config


stderr_logger = logging.getLogger('stderr')


def connect():
    connection_str = 'dbname={name} user={user} password={pw}'.format(name=config['db']['name'],
                                                                      user=config['db']['user'],
                                                                      pw=config['db']['password'])
    connection = psycopg2.connect(connection_str,
                                  connection_factory=psycopg2.extras.LoggingConnection)
    connection.initialize(stderr_logger)
    g.cursor = connection.cursor()
    g.exception_occurred = False


def disconnect():
    if g.get('exception_occurred', True):
        g.cursor.rollback()
    else:
        g.cursor.commit()

    connection = g.cursor.connection
    g.cursor.close()
    connection.close()
