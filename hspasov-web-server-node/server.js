const { Server } = require('net');
const CONFIG = require('./config.js');
const {
  log,
  errorLogLevels: {
    ERROR,
  },
} = require('./logger.js');

const server = new Server();

server.on('listening', (...args) => {
  log.error(ERROR, { msg: 'listening args:' });
  log.error(ERROR, { msg: args });
});

server.on('connection', (socket) => {
  log.error(ERROR, { msg: socket });
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
