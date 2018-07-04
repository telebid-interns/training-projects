const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const send = require('koa-send');
const resolveMethod = require('./methods/resolve-method');
const { normalize, denormalize } = require('./modules/normalize');
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
app.use(serve(path.join(__dirname, 'public')));

app.context.db = db;

router.post('/', async (ctx, next) => {
  console.log(typeof ctx.request.rawBody);
  console.log(ctx.request.rawBody.length);
  const normalized = normalize(ctx.request.body, ctx.headers['content-type'], ctx.query.format);
  const method = resolveMethod(normalized);
  const result = await method.execute(normalized.params, ctx.db);
  const denormalized = denormalize(normalized, result, ctx.headers['content-type'], ctx.query.format);

  ctx.status = 200;
  ctx.body = denormalized;
});

router.get('/', async (ctx, next) => {
  ctx.status = 200;
  await send(ctx, 'public/index.html');
});

app.use(router.routes());

app.listen(3000);

console.log('Listening on 3000...');
