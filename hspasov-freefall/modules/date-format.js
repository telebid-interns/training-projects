// This server works with ISO 8601 time standard.
const SERVER_DATE_FORMAT = 'Y-MM-DD';
const KIWI_API_DATE_FORMAT = 'DD/MM/Y';
const moment = require('moment');
const { assertPeer, assertApp } = require('./error-handling');

function today () {
  return moment().format(SERVER_DATE_FORMAT);
}

function dateMonthsFromNow (months) {
  assertApp(Number.isInteger(months), 'Invalid month.');

  const dateParsed = moment(today(), SERVER_DATE_FORMAT);

  assertApp(dateParsed.isValid(), 'Invalid date format.');

  dateParsed.add(months, 'months');

  return dateParsed.format(SERVER_DATE_FORMAT);
}

function toKiwiAPIDateFormat (date) {
  const dateParsed = moment(date, SERVER_DATE_FORMAT);

  assertApp(dateParsed.isValid(), 'Invalid date format.');

  return dateParsed.format(KIWI_API_DATE_FORMAT);
}

function fromUnixTimestamp (date) {
  assertPeer(Number.isInteger(date), 'Invalid date format.');

  const dateParsed = moment.unix(date);

  assertPeer(dateParsed.isValid(), 'Invalid date format.');

  return dateParsed.format(SERVER_DATE_FORMAT);
}

module.exports = {
  today,
  dateMonthsFromNow,
  toKiwiAPIDateFormat,
  fromUnixTimestamp
};
