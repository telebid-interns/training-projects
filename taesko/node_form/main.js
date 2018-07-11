const Koa = require('koa');
const koaBody = require('koa-body');
const Router = require('koa-router');
const serve = require('koa-static');
const views = require('koa-views');
const logger = require('koa-logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

const database = require('./database');

const app = new Koa();
const router = new Router();

app.use(logger());

app.use(views(path.join(__dirname, '/views'), {
  map: {
    html: 'swig'
  }
}));

app.use(async function (ctx, next) {
  ctx.state = {
    session: this.session,
    title: 'norm-app'
  };

  await next();
});

router.get('/', serve('static'));

async function renderNamePage (ctx, name) {
  if (database.exists(name)) {
    await ctx.render('name.html', database.getRecord(name));
  } else {
    await ctx.render('name-not-found.html', {name});
  }
}

router.get('/names', async (ctx, next) => {
  const name = ctx.query.name;

  await renderNamePage(ctx, name);
  await next();
});

router.post('/names',
  koaBody({multipart: true}),
  async (ctx, next) => {
    const {name} = ctx.request.body;

    if (!name) {
      ctx.body = 'Bad post request';
      await next();
      return;
    }

    database.upload(name, ctx.request.files.file);
    await renderNamePage(ctx, name);
    await next();
  }
);

app.use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
