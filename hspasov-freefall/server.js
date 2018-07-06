const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const send = require('koa-send');
const cors = require('@koa/cors');
const resolveMethod = require('./methods/resolve-method');
const { defineParsers, jsonParser, yamlParser } = require('./modules/normalize');
const { PeerError, UserError, AppError } = require('./modules/error-handling.js');
const db = require('./modules/db.js');

const parser = defineParsers(jsonParser, yamlParser);

const app = new Koa();
const router = new Router();

app.on('error', (err, ctx) => {
  console.log('inside error');
  console.log(err);
  // ctx.status = 200;
  // if (err instanceof PeerError) {
  //   const denormalized = denormalize(normalize())
  // } else if (err instanceof UserError) {

  // } else if (err instanceof AppError) {

  // }
});

db.dbConnect();

app.use(logger());
app.use(cors({
  origin: '*'
}));
app.use(bodyParser({
  extendTypes: {
    text: ['text/yaml']
  },
  enableTypes: ['json', 'form', 'text']
}));
app.use(serve(path.join(__dirname, 'public')));

app.context.db = db;

router.post('/', async (ctx, next) => {
  const parsed = parser.parse(ctx.request.body, {
    contentType: ctx.headers['content-type'],
    format: ctx.query.format
  });
  const method = resolveMethod(parsed);
  const result = await method.execute(parsed.params, ctx.db);
  const stringified = parser.stringify(result, {
    contentType: ctx.headers['content-type'],
    format: ctx.query.format
  }, parsed.version, parsed.id);

  ctx.status = 200;
  ctx.body = stringified;
});

router.get('/', async (ctx, next) => {
  ctx.status = 200;
  await send(ctx, 'public/index.html');
});

app.use(router.routes());

app.listen(3000);

console.log('Listening on 3000...');
