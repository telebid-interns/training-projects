const { trace } = require('./../debug/tracer.js');
const { EMAIL_VALIDATION_REGEX } = require('./../utils/consts.js');
const db = require('./../database/pg_db.js');

const generateRandomString = (length) => {
  trace(`Function generateRandomString`);

  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

const isObject = (obj) => {
  return typeof obj === 'object' && obj != null;
};

const formatDate = (date) => {
  trace(`Function formatDate`);

  return date.substr(0, 10);
};

function validateEmail (email) {
  return EMAIL_VALIDATION_REGEX.test(String(email));
}

async function makeTransaction (func) {
  await db.query('BEGIN');
  console.log('BEGIN');
  try {
    await func();
    await db.query('COMMIT');
    console.log('COMMIT');
  } catch(err) {
    await db.query('ROLLBACK');
    console.log('ROLLBACK');
    throw err;
  }
}

function isInteger(num) {
  return (typeof num === 'number') && (num % 1 === 0);
}

module.exports = {
  generateRandomString,
  isObject,
  formatDate,
  validateEmail,
  makeTransaction,
  isInteger
};
