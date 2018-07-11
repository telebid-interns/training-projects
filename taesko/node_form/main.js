const Koa = require('koa');
const Router = require('koa-router');
const serve = require('koa-static');
const views = require('koa-views');
const fs = require('fs');

const app = new Koa();
const router = new Router();
const database = (() => {
  if (!fs.existsSync('db.json')) {
    fs.writeFileSync('db.json', '{}');
  }

  const save = () => {
    fs.writeFileSync('db.json', JSON.stringify(storage));
  };
  const read = () => {
    storage.data = JSON.parse(fs.readFileSync('db.json'));
  };

  let storage = {
    read,
    save,
    data: undefined
  };

  storage.read();
  return storage;
})();

//app.use(views(__dirname + '/views'))
router.get('/', serve('static'));
router.get('/static', serve('static'));

router.get('/:name', async (ctx, next) => {
  const name = ctx.params.name || ctx.query.name;

  console.log("checking database for name", database, name);

  if (database.data[name]) {
    ctx.body = `Greetings ${name}`;
  } else {
    ctx.body = `${name} is not registered yet.`
  }

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

app.listen(3000);
