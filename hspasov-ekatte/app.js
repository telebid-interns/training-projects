const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const Router = require('koa-router');
const send = require('koa-send');
const { Client } = require('pg');
const path = require('path');

const app = new Koa();
const router = new Router();

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'ekatte',
  password: 'ekatte',
  database: 'ekatte'
});

client.connect();

app.use(logger());
app.use(bodyParser());
app.use(serve(path.join(__dirname)));

app.context.db = client;

router.get('/', async (ctx, next) => {
  await send(ctx, 'index.html');
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);

console.log('Listening on 3000...');
