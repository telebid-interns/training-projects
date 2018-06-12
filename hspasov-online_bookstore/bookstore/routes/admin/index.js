const combineRouters = require('koa-combine-routers');
const users = require('./users');
const pages = require('./pages');

module.exports = combineRouters([
  users,
  pages
]);
