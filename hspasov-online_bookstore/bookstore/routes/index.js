const combineRouters = require('koa-combine-routers');
const authentication = require('./authentication');
const pages = require('./pages');

module.exports = combineRouters([
  authentication,
  pages
]);
