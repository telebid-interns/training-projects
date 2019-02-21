'use strict';

const { CONFIG } = require('./config.js');
const {
  log,
  errorLogLevels: {
    DEBUG,
  },
} = require('./logger.js');

const clientConnStates = Object.freeze({
  ESTABLISHED: 1,
  RECEIVING: 2,
  SENDING: 3,
  CLOSED: 4,
});

const clientConnection = (clientConnections, id, socket) => {
  socket.setTimeout(CONFIG.socket_timeout);

  socket.on('data', (...args) => {
    log.error(DEBUG, { msg: 'data', var_name: 'args', var_value: args });
  });

  socket.on('timeout', (...args) => {
    log.error(DEBUG, { msg: 'timeout', var_name: 'args', var_value: args });
  });

  socket.on('end', (...args) => {
    log.error(DEBUG, { msg: 'end', var_name: 'args', var_value: args });
  });

  socket.on('error', (...args) => {
    log.error(DEBUG, { msg: 'error', var_name: 'args', var_value: args });
  });

  socket.on('close', (...args) => {
    clientConnections.delete(id);
    log.error(DEBUG, { msg: 'close', var_name: 'args', var_value: args });
  });

  return {
    id,
    socket,
    state: clientConnStates.ESTABLISHED,
  };
};

module.exports = {
  clientConnection,
};
