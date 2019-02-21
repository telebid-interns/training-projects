'use strict';

const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config.js');
const {
  log,
  errorLogLevels: {
    ERROR,
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

        const targetResolvedPath = path.join(
          CONFIG.web_server_root,
          CONFIG.document_root,
          connData.reqMeta.path
        );

        fs.stat(targetResolvedPath, (err, stats) => {
          if (err) {
            console.log(err);
            // TODO handle
          }

          responseHeaders['Content-Length'] = stats.size.toString();

          // TODO can it throw?
          const readStream = fs.createReadStream(targetResolvedPath, {
            flags: 'r',
          });

          readStream.on('close', () => {
            log.error(DEBUG, { msg: `${connData.id.toString()}: readStream closed` });
          });

          readStream.on('data', (data) => {
            socket.write(data, () => {
              log.error(DEBUG, { msg: `${connData.id.toString()}: data sent to socket` });
              console.log(data);
            });

            if (socket.bufferSize >= CONFIG.send_buffer) {
              log.error(DEBUG, { msg: `${connData.id.toString()}: socket send buffer filled` });
              readStream.pause();
            }
          });

          readStream.on('end', () => {
            log.error(DEBUG, { msg: `${connData.id.toString()}: all data from readStream consumed` });
            socket.removeAllListeners('drain');
            socket.end();
          });

          readStream.on('error', (error) => {
            log.error(ERROR, { var_name: 'error', var_value: error, msg: `${connData.id.toString()}: readStream error` });
            // TODO sent error to client in some cases
          });

          socket.on('drain', () => {
            log.error(DEBUG, { msg: `${connData.id.toString()} socket send buffer drained` });
            readStream.resume();
          });

          // TODO do this in a separate function
          connData.resMeta = {
            statusCode: 200,
            headers: responseHeaders,
          };

          const resMetaMsg = buildResMeta(connData.resMeta);
          socket.write(resMetaMsg, 'binary', () => {
            log.error(DEBUG, { msg: `${connData.id.toString()}: data sent to socket` });
            console.log(resMetaMsg);
          });
        });
      } else if (connData.reqMetaRaw.length > CONFIG.req_meta_limit) {
        // TODO handle error
      }
    } else {
      socket.end();
      log.error(DEBUG, { msg: `${connData.id.toString()}: data received while in SENDING or CLOSED state` });
    }

    log.error(DEBUG, { msg: `${connData.id.toString()}: data received`, var_name: 'data', var_value: data });
  });

  socket.on('timeout', () => {
    log.error(DEBUG, { msg: `${connData.id.toString()}: timeout` });
  });

  socket.on('end', () => {
    log.error(DEBUG, { msg: `${connData.id.toString()}: FIN sent by other side` });
  });

  socket.on('error', (error) => {
    log.error(ERROR, { msg: `${connData.id.toString()}: socket error`, var_name: 'error', var_value: error });
  });

  socket.on('close', (hadError) => {
    clientConnections.delete(id);
    log.error(DEBUG, { msg: `${connData.id.toString()}: close`, var_name: 'hadError', var_value: hadError });
  });

  return connData;
};

module.exports = {
  clientConnection,
};
