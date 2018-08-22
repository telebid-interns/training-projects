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

  if (typeof date === 'string') return date.substr(0, 10);

  const year = date.getFullYear();
  let month = `${date.getMonth() + 1}`; // months start FROM 0
  let day = `${date.getDate()}`;

  if (month.length < 2) month = `0${month}`;
  if (day.length < 2) day = `0${day}`;

  return [day, month, year].join('-');
}

const validateEmail = (email) => {
  return EMAIL_VALIDATION_REGEX.test(String(email));
}

const isInteger = (num) => {
  return (typeof num === 'number') && (num % 1 === 0);
}

// (async () => {
//   const salt = generateRandomString(SALT_LENGTH);
//   const saltedPassword = 'admin' + salt;
//   const hash = await bcrypt.hash(saltedPassword, SALT_ROUNDS);
//   await db.query(`insert into backoffice_users (username, password, salt) values ('admin', $1, $2)`, hash, salt);
// })();

module.exports = {
  generateRandomString,
  isObject,
  formatDate,
  validateEmail,
  isInteger
};
