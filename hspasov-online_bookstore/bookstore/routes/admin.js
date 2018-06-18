const Router = require('koa-router');
const send = require('koa-send');

const router = new Router({ prefix: '/admin' });

router.get('/', async (ctx, next) => {
  await send(ctx, 'public/html/admin.html');
});

router.get('/users', async (ctx, next) => {
  try {
    const result = await ctx.db.query('SELECT * FROM users;');
    if (result.rows.length > 0) {
      ctx.status = 200;
      ctx.body = result.rows;
    } else {
      ctx.status = 404;
    }
  } catch (error) {
    console.log(error);
    ctx.throw();
  }
});

module.exports = router;
