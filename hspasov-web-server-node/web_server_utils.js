'use strict';

const assert = (condition, msg = '') => {
  if (typeof condition !== 'boolean') {
    throw Error(`typeof condition not boolean, but ${typeof condition}. condition: ${condition}`);
  }

  if (!condition) {
    throw Error(`condition failed: ${msg}`);
  }
};

const isObject = (item) => {
  return typeof item === 'object' && item !== null;
};

const stringifyObject = (obj) => {
  assert(isObject(obj));

  try {
    return JSON.stringify(obj);
  } catch (error) {
    return obj.toString();
  }
};

module.exports = {
  assert,
  isObject,
  stringifyObject,
};
