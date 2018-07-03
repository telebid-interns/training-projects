const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const resolveMethod = require('./methods/resolve-method');
const normalize = require('./modules/normalize');
const db = require('./modules/db.js');

const app = new Koa();
const router = new Router();

db.dbConnect();

app.use(logger());
app.use(bodyParser({
  extendTypes: {
    text: ['text/yaml']
  },
  enableTypes: ['json', 'form', 'text']
}));

app.context.db = db;

router.post('/', async (ctx, next) => {
  const normalized = normalize(ctx.request.body, ctx.headers['content-type'], ctx.query.format);
  const method = resolveMethod(normalized);

  await method.execute(normalized.params, ctx.db);
});

router.get('/', (ctx, next) => {
  ctx.status = 200;
  ctx.response.body = '';
});

app.use(router.routes());

app.listen(3000);

console.log('Listening on 3000...');
