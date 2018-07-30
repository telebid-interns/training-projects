const { trace } = require('./../debug/tracer.js');
const { EMAIL_VALIDATION_REGEX } = require('./../utils/consts.js');

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

module.exports = {
  generateRandomString,
  isObject,
  formatDate,
  validateEmail,
};
