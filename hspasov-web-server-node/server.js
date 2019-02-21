'use strict';

const { Server } = require('net');
const { CONFIG } = require('./config.js');
const {
  log,
  errorLogLevels: {
    ERROR,
    INFO,
    DEBUG,
  },
} = require('./logger.js');
const { clientConnection } = require('./client_connection.js');

const start = () => {
  const server = new Server();
  const clientConnections = new Map();

  server.on('listening', () => {
    log.error(INFO, { msg: `listening on ${CONFIG.host} ${CONFIG.port}...` });
  });

  server.on('connection', (socket) => {
    log.error(DEBUG, { msg: 'new connection' });
    const id = Symbol('client connection');
    const conn = clientConnection(clientConnections, id, socket);
    clientConnections.set(id, conn);
  });

  server.on('error', (...args) => {
    log.error(ERROR, { msg: 'error args:' });
    log.error(ERROR, { msg: args });
  });

  server.on('close', (...args) => {
    log.error(ERROR, { msg: 'close args:' });
    log.error(ERROR, { msg: args });
  });

  // TODO check IPC and cluster workers
  server.listen({
    port: CONFIG.port,
    host: CONFIG.host,
    backlog: CONFIG.backlog,
  });
};

module.exports = {
  start,
};
