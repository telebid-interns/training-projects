module.exports = (() => {
  const fetch = require('node-fetch');
  const toQueryString = require('./to-query-string');
  const { assertApp } = require('./error-handling');

  async function requestJSON (url, parameters) {
    assertApp(
      typeof url === 'string',
      'Invalid url.'
    );

    let shouldPutQuestionMark = false;
    const questionMarkMatches = url.match(/\?/g);

    if (questionMarkMatches === null && parameters) {
      shouldPutQuestionMark = true;
    }

    const uri = url +
      ((shouldPutQuestionMark) ? '?' : '') +
      ((parameters) ? toQueryString(parameters) : '');

    console.log(uri);
    const response = await fetch(uri);
    return response.json();
  }

  return {
    requestJSON
  };
})();
