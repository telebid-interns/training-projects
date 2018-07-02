const search = require('./search');
const { assertUser, UserError } = require('../modules/error-handling');
const isObject = require('../modules/is-object');

module.exports = function resolveMethod (body) {
  assertUser(
    isObject(body) &&
    typeof body.method === 'string',
    'Invalid input format. Method not found.'
  );

  if (body.method === 'search') {
    return {
      name: 'search',
      execute: search
    };
  } else {
    throw new UserError(`Unknown method "${body.method}"`);
  }
};
