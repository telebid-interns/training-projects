'use strict';

const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config.js');
const {
  log,
  errorLogLevels: {
    DEBUG,
  },
} = require('./logger.js');
const {
  parseReqMeta,
  buildResMeta,
} = require('./http_msg_formatter.js');

const clientConnStates = Object.freeze({
  ESTABLISHED: 1,
  RECEIVING: 2,
  SENDING: 3,
  CLOSED: 4,
});

const clientConnection = (clientConnections, id, socket) => {
  const connData = {
    id,
    socket,
    state: clientConnStates.ESTABLISHED,
    reqMetaRaw: '',
    reqMeta: {},
    resMeta: {},
  };

  socket.setTimeout(CONFIG.socket_timeout);
  socket.setEncoding('utf-8');

  socket.on('data', (data) => {
    // TODO handle buffer overfilled, use socket.pause() and socket.resume()
    if (connData.state === clientConnStates.ESTABLISHED) {
      connData.state = clientConnStates.RECEIVING;
    }

    if (connData.state === clientConnStates.RECEIVING) {
      connData.reqMetaRaw += data;

      const reqMetaEnd = connData.reqMetaRaw.indexOf('\r\n\r\n');

      if (reqMetaEnd >= 0) {
        log.error(DEBUG, { msg: 'reached end of request meta' });

        // ignoring body, if any
        connData.reqMetaRaw = connData.reqMetaRaw.substring(0, reqMetaEnd);

        // TODO error handling, parseReqMeta may throw
        connData.reqMeta = parseReqMeta(connData.reqMetaRaw);

        connData.state = clientConnStates.SENDING;

        const responseHeaders = Object.create(null);

        fs.stat(path.join(
          CONFIG.web_server_root,
          CONFIG.document_root,
          connData.reqMeta.path
        ), (err, stats) => {
          if (err) {
            console.log(err);
            // TODO handle
          }

          responseHeaders['Content-Length'] = stats.size.toString();

          // TODO do this in a separate function
          connData.resMeta = {
            statusCode: 200,
            headers: responseHeaders,
          };

          const resMetaMsg = buildResMeta(connData.resMeta);
          socket.write(resMetaMsg, 'utf-8', (...args) => {
            console.log('inside write callback. args:');
            socket.end();
          });
        });
      } else if (connData.reqMetaRaw.length > CONFIG.req_meta_limit) {
        // TODO handle error
      }
    } else {
      // TODO handle error
    }

    log.error(DEBUG, { msg: 'data received', var_name: 'data', var_value: data });
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

  return connData;
};

module.exports = {
  clientConnection,
};
