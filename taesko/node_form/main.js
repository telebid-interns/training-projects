const Koa = require('koa');
const Router = require('koa-router');
const serve = require('koa-static');

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-response-time', `${ms}ms`);
});

router.get('/', serve('static'));
router.get('/static', serve('static'));

router.get('/:name', async (ctx, next) => {
  const name = ctx.params.name || ctx.query.name;

  ctx.body = `Greetings ${name}`;
  await next();
});

router.get('/:name/files', async (ctx, next) => {
  ctx.body = `All your files are: \n`;
  await next();
});

router
  .get('/:name/files/:file', async (ctx, next) => {
    ctx.body = `Serving your file: ${ctx.params.file}`;
    await next();
  })
  .post('/:name/files/:file', async (ctx, next) => {
    ctx.body = `Uploading file: ${ctx.request.body}`;
    await next();
  });

app.use(router.routes())
  .use(router.allowedMethods());

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - response took ${ms}ms`);
});

app.listen(3000);
