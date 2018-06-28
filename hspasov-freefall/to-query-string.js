module.exports = function toQueryString (params) {
  const paramsList = [];

  for (const [param, val] of Object.entries(params)) {
    paramsList.push([encodeURIComponent(param), encodeURIComponent(val)]);
  }

  return paramsList.map(pair => pair.join('=')).join('&');
};
