const moment = require('moment');
const { assertPeer } = require('./error-handling');

function toKiwiAPIDateFormat (date) {
  const dateParsed = moment(date, 'Y-MM-DD');
  assertPeer(dateParsed.isValid(), 'Invalid date format.');
  return dateParsed.format('DD/MM/Y');
}

function fromKiwiAPIDateFormat (date) {
  const dateParsed = moment(date, 'DD/MM/Y');
  assertPeer(dateParsed.isValid(), 'Invalid date format.');
  return dateParsed.format('Y-MM-DD');
}

module.exports = {
  toKiwiAPIDateFormat,
  fromKiwiAPIDateFormat
};
