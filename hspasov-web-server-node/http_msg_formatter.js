'use strict';

const { unescape } = require('querystring');
const { assert, isObject } = require('./web_server_utils.js');

const allowedHTTPMethods = Object.freeze([
  'GET',
]);

const responseReasonPhrases = new Map([
  [ 200, 'OK' ],
]);

const parseReqMeta = (reqMeta) => {
  assert(typeof reqMeta === 'string');

  const reqMetaLines = reqMeta.split('\r\n');

  if (reqMetaLines.length <= 0) {
    throw Error('invalid request');
  }

  const [reqLine, ...headerLines] = reqMetaLines;
  const reqLineSplit = reqLine.split(' ');

  if (reqLineSplit.length !== 3) {
    throw Error('invalid request');
  }

  const [method, targetEscaped, httpVersion] = reqLineSplit;
  const target = unescape(targetEscaped);

  if (!allowedHTTPMethods.includes(method)) {
    throw Error('invalid request');
  }

  const targetSplit = target.split('?');

  let queryString;

  if (targetSplit.length === 1) {
    queryString = '';
  } else if (targetSplit.length === 2) {
    queryString = targetSplit[1];
  } else {
    throw Error('invalid request');
  }

  const path = targetSplit[0];

  const headers = Object.create(null);

  for (const headerLine of headerLines) {
    const headerLineSplit = headerLine.split(':', 2);

    if (headerLineSplit.length !== 2) {
      throw Error('invalid request');
    }

    const [fieldName, fieldValUntrimmed] = headerLineSplit;

    if (fieldName.length !== fieldName.trim().length) {
      throw Error('invalid request');
    }

    const fieldValue = fieldValUntrimmed.trim();

    headers[fieldName] = fieldValue;
  }

  const userAgent = headers['User-Agent'] || '';

  return {
    reqLineRaw: reqLine,
    method,
    target,
    path,
    queryString,
    httpVersion,
    headers,
    userAgent,
  };
};

const buildResMeta = (resMeta) => {
  assert(isObject(resMeta));
  assert(responseReasonPhrases.has(resMeta.statusCode));

  const headers = Object.entries(resMeta.headers)
    .map(([name, val]) => `${name}: ${val}`)
    .join('\r\n');

  return `HTTP/1.1 ${resMeta.statusCode} ${responseReasonPhrases.get(resMeta.statusCode)}\r\n${headers}\r\n\r\n`;
};

module.exports = {
  parseReqMeta,
  buildResMeta,
};
