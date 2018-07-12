const Koa = require('koa');
const db = require('./../database/db.js');
const api = require('./../api/api.js');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');

const app = new Koa();
const PORT = 3001;

const server = app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`);
});

db.connect();

app.use(router.routes());
app.use(router.allowedMethods());

app.use(bodyParser());

router.post('/', async (ctx, next) => {
	const city = ctx.request.url.split('city=')[1];
	ctx.body = await db.query(`select * from cities where name = '${city}'`); // TODO escape
});

// const forecast = api.getForecast('London');

module.exports = server;
