const assert = require('assert');
const Router = require('koa-router');
// const send = require('koa-send');

const router = new Router({ prefix: '/users' });

router.get('/', async (ctx, next) => {
  try {
    const result = await ctx.db.query(`SELECT * FROM users;`);
    assert.strictEqual(typeof (result), 'object', 'Result of query is not an object.');
    assert.strictEqual(Array.isArray(result.rows), true, 'Property \'rows\' of query result is not an array.');
    ctx.status = 200;
    ctx.body = result.rows;
  } catch (error) {
    console.error(error);
    ctx.throw();
  }
});

module.exports = router;
