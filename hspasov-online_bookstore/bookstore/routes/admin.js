const assert = require('assert');
const Router = require('koa-router');
const send = require('koa-send');

const router = new Router({ prefix: '/admin' });

router.get('/', async (ctx, next) => {
  await send(ctx, 'public/html/admin.html');
});

router.get('/users', async (ctx, next) => {
  try {
    const result = await ctx.db.query('SELECT * FROM users;');
    assert.strictEqual(typeof (result), 'object', 'Result of query is not an object.');
    assert.strictEqual(Array.isArray(result.rows), true, 'Property \'rows\' of query result is not an array.');
    if (result.rows.length > 0) {
      ctx.status = 200;
      console.log(result.rows);
      await ctx.render('users', { users: result.rows });
    } else {
      ctx.status = 404;
    }
  } catch (error) {
    console.log(error);
    ctx.throw();
  }
});

router.get('/users/:id', async (ctx, next) => {
  ctx.assert(ctx.params.id, 'User id not provided');
  ctx.assert(!Number.isInteger(ctx.params.id), 'Please provide a number of user id: /users/:id');
  ctx.assert(ctx.params.id >= 1, 'Please provide a positive integer for a number of user id!');
  try {
    const result = await ctx.db.query('SELECT * FROM users WHERE id = $1;', [ctx.params.id]);
    await ctx.render('users', { users: result.rows });
  } catch (error) {
    console.log(error);
    ctx.throw();
  }
});

module.exports = router;
