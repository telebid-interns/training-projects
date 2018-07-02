const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const db = require('./modules/db.js');
const { assertUser, UserError } = require('./modules/error-handling.js');

const app = new Koa();
const router = new Router();

app.use(logger());
app.use(bodyParser({
  extendTypes: {
    text: ['text/yaml']
  },
  enableTypes: ['json', 'form', 'text']
}));

app.context.db = db;

router.post('/', (ctx, next) => {
  if (ctx.headers['content-type'] === 'application/json') {
    assertUser(
      ctx.query.format === 'json' ||
      !ctx.query.format,
      'Ambiguous content type.'
    );
  } else if (ctx.headers['content-type'] === 'text/yaml') {
    assertUser(
      ctx.query.format === 'yaml' ||
      !ctx.query.format,
      'Ambiguous content type.'
    );
  } else if (!ctx.headers['content-type']) {
    if (ctx.query.format === 'json') {

    } else if (ctx.query.format === 'yaml') {

    } else {
      throw UserError('Unknown content type.');
    }
  } else {
    throw UserError('Unknown content type.');
  }
  console.log(ctx.req);
  console.log('content-type:', ctx.headers['content-type']);
  console.log('query:', ctx.query);
  console.log('body:', ctx.request.body);
});

router.get('/', (ctx, next) => {
  ctx.status = 200;
  ctx.response.body = '';
});

app.use(router.routes());

app.listen(3000);

console.log('Listening on 3000...');
