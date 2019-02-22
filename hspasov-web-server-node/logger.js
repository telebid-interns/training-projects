'use strict';

const { createWriteStream } = require('fs');
const { assert, isObject } = require('./web_server_utils.js');
const { CONFIG } = require('./config.js');

const errorLogLevels = {
  ERROR: 1,
  INFO: 2,
  WARNING: 3,
  DEBUG: 4,
};

// TODO check what happens if createWriteStream fails
// TODO close
const accessLog = createWriteStream(CONFIG.access_log, {
  flags: 'a', // open for appending, create if not exists
  encoding: 'utf-8',
  autoClose: true,
  mode: 0o666,
});

let accessLogAvailable = true;

accessLog.on('close', () => {
  error(errorLogLevels.DEBUG, { msg: 'closed access log' });
});

accessLog.on('error', (e) => {
  error(errorLogLevels.DEBUG, { msg: 'access log error', var_name: 'error', var_value: e });
});

const error = (level, fields) => {
  assert(Object.values(errorLogLevels).includes(level));
  assert(isObject(fields));

  const fieldsList = [];

  if (CONFIG.error_log_fields.includes('pid')) {
    fieldsList.push(process.pid);
  }

  if (CONFIG.error_log_fields.includes('timestamp')) {
    const now = new Date();
    fieldsList.push(now.toISOString());
  }

  if (CONFIG.error_log_fields.includes('level')) {
    fieldsList.push(level);
  }

  if (CONFIG.error_log_fields.includes('context')) {
    fieldsList.push(CONFIG.error_log_empty_field); // TODO
  }

  if (CONFIG.error_log_fields.includes('var_name')) {
    fieldsList.push('var_name' in fields ? fields.var_name : CONFIG.error_log_empty_field);
  }

  if (CONFIG.error_log_fields.includes('var_value')) {
    fieldsList.push('var_value' in fields ? `${fields.var_value} /${typeof fields.var_value}/` : CONFIG.error_log_empty_field);
  }

  if (CONFIG.error_log_fields.includes('msg')) {
    fieldsList.push('msg' in fields ? fields.msg : CONFIG.error_log_empty_field);
  }

  console.error(fieldsList.join(CONFIG.error_log_field_sep));
};

const access = (fields) => {
  if (CONFIG.access_log_enabled && accessLogAvailable) {
    // TODO assert access log initialized
    const fieldsList = [];

    if (CONFIG.access_log_fields.includes('pid')) {
      fieldsList.push(process.pid);
    }

    if (CONFIG.access_log_fields.includes('timestamp')) {
      const now = new Date();
      fieldsList.push(now.toISOString());
    }

    if (CONFIG.access_log_fields.includes('remote_addr')) {
      fieldsList.push('remote_addr' in fields ? fields.remote_addr : CONFIG.access_log_empty_field);
    }

    if (CONFIG.access_log_fields.includes('req_line')) {
      fieldsList.push('req_line' in fields ? fields.req_line : CONFIG.access_log_empty_field);
    }

    if (CONFIG.access_log_fields.includes('user_agent')) {
      fieldsList.push('user_agent' in fields ? fields.user_agent : CONFIG.access_log_empty_field);
    }

    if (CONFIG.access_log_fields.includes('status_code')) {
      fieldsList.push('status_code' in fields ? fields.status_code : CONFIG.access_log_empty_field);
    }

    if (CONFIG.access_log_fields.includes('content_length')) {
      fieldsList.push('content_length' in fields ? fields.content_length : CONFIG.access_log_empty_field);
    }

    const accessLogEntry = fieldsList.join(CONFIG.access_log_field_sep);

    // TODO check what happens on error
    const canWriteMore = accessLog.write(accessLogEntry, 'utf-8', () => {
      error(errorLogLevels.DEBUG, { msg: 'write to access log' });
    });

    if (!canWriteMore) {
      error(errorLogLevels.ERROR, { msg: 'access log write stream buffer filled. logging temporarily turned off. logs might be missing' });
      accessLogAvailable = false;
      accessLog.on('drain', () => {
        error(errorLogLevels.ERROR, { msg: 'access log write stream buffer drained. logging turned on.' });
        accessLogAvailable = true;
        accessLog.removeAllListeners('drain');
      });
    }
  }
};

module.exports = {
  log: {
    error,
    access,
  },
  errorLogLevels,
};
