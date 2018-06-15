const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const { Client } = require('pg');
const path = require('path');
const render = require('koa-ejs');

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

app.context.db = client;

render(app, {
  root: path.join(__dirname, 'view'),
  layout: false,
  viewExt: 'ejs',
  cache: false,
  debug: true
});

router.get('/', async (ctx, next) => {
  await ctx.render('index');
});

router.get('/search', async (ctx, next) => {
  const results = await ctx.db.query(`SELECT id, name FROM ekattes
    WHERE name LIKE $1::TEXT;`, [`%${ctx.query.settlement}%`]);

  const resultLinks = results.rows.map(row => {
    return {
      name: row.name,
      link: `/settlements?settlement=${row.id}`
    };
  });

  await ctx.render('result', { resultLinks });
});

router.get('/settlements', async (ctx, next) => {
  const result = await ctx.db.query(`SELECT id, kind, name, category, altitude_code, document
    FROM ekattes WHERE id = $1;`, [ctx.query.settlement]);

  await ctx.render('settlement', {
    settlement: result.rows[0]
  });
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);

console.log('Listening on 3000...');
