const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const { assert, assertUser } = require('./../asserts/asserts.js');
const { AppError, PeerError, UserError } = require('./../asserts/exceptions.js');
const { trace, clearTraceLog } = require('./../debug/tracer.js');
const {
  generateRandomString,
  formatDate,
  validateEmail,
  isObject,
  makeTransaction,
  isInteger,
} = require('./../utils/utils.js');
const { getForecast, generateAPIKey, deleteAPIKey } = require('./../api/api.js');
const db = require('./../database/pg_db.js');
const serve = require('koa-static');
const bcrypt = require('bcrypt');
const session = require('koa-session');
const views = require('koa-views');
const {
  PORT,
  MINIMUM_USERNAME_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  MAX_REQUESTS_PER_HOUR,
  MAXIMUM_CREDITS_ALLOWED
} = require('./../utils/consts.js');

const app = new Koa();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`);
});

app.keys = ['DaliKrieTaini'];

// (cookie lifetime): (Milliseconds)
app.use(session({ maxAge: 1000 * 60 * 60 * 24 }, app));

app.use(serve(`${__dirname}/public/css`));
app.use(serve(`${__dirname}/public/js`));

app.use(views(`${__dirname}/views`, {
  extension: 'hbs',
  map: { hbs: 'handlebars' }, // marks engine for extensions
}));

clearTraceLog();

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof UserError) {
      ctx.body = {
        message: err.message,
        statusCode: err.statusCode
      };
    } else if (err instanceof PeerError) {
      ctx.body = {
        message: err.message,
        statusCode: err.statusCode
      };
    } else {
      console.log(err);
      console.log(`Application Error: ${ err.message }, Status code: ${ err.statusCode }`);
      ctx.body = 'An error occured please clear your cookies and try again';
    }
  }
});

app.use(bodyParser());

// GET root
router.get('/', async (ctx, next) => {
  trace(`GET '/'`);

  await ctx.redirect('/home');
});

// GET logout
router.get('/logout', async (ctx, next) => {
  trace(`GET '/logout'`);

  ctx.session = null; // docs: "To destroy a session simply set it to null"
  await ctx.redirect('/login');
});

// GET home
router.get('/home', async (ctx, next) => {
  trace(`GET '/home'`);

  if (ctx.session.user == null) {
    ctx.redirect('/login');
    return next();
  }

  const user = (await db.query(`SELECT * FROM users WHERE username = $1`, ctx.session.user)).rows[0];
  assert(user != null, 'cookie contained username not in database', 10);

  const keys = (await db.query(`SELECT * FROM api_keys WHERE user_id = $1`, user.id)).rows;
  assert(Array.isArray(keys), 'keys expected to be array but wasnt', 15);

  await ctx.render(
    'home',
    {
      user: ctx.session.user,
      credits: user.credits,
      limit: MAX_REQUESTS_PER_HOUR,
      keys,
    });
});

// GET login
router.get('/login', async (ctx, next) => {
  trace(`GET '/login'`);

  if (ctx.session.user != null) {
    ctx.redirect('/home');
  }

  await ctx.render('login', {
    err: ctx.query.err,
    success: ctx.query.success,
  });
});

// GET register
router.get('/register', async (ctx, next) => {
  trace(`GET '/register'`);

  if (ctx.session.user != null) {
    ctx.redirect('/home');
  }

  await ctx.render('register', { err: ctx.query.err });
});

// GET admin
router.get('/admin', async (ctx, next) => {
  trace(`GET '/admin'`);

  if (ctx.session.admin == null) {
    await ctx.render('admin_login', { err: ctx.query.err });
  } else {
    let users;
    if (ctx.query.term == null) {
      users = (await db.query(`SELECT * FROM users`)).rows;
    } else {
      const term = `%${ctx.query.term}%`;
      users = (await db.query(`SELECT * FROM users WHERE username LIKE $1`, term)).rows;
    }

    users = users.sort((u1, u2) => {
      const first = new Date(parseInt(u1.date_registered));
      const second = new Date(parseInt(u2.date_registered));
      return first - second;
    });

    users = users.map((user) => {
      user.date_registered = formatDate(user.date_registered);
      return user;
    });

    await ctx.render('admin', {
      users,
      maxRequests: MAX_REQUESTS_PER_HOUR,
    });
  }
});

// GET buy
router.get('/buy', async (ctx, next) => {
  trace(`GET '/buy'`);

  await ctx.render('buy', { success: ctx.query.success, error: ctx.query.err});
});

// POST buy
router.post('/buy', async (ctx, next) => {
  trace(`POST '/buy'`);
  // TODO if session.user not str

  assert(isObject(ctx.request.body), 'Post buy has no body', 12);

  const credits = ctx.request.body.credits;

  const user = (await db.query(`SELECT * FROM users WHERE username = $1`, ctx.session.user)).rows[0];
  assert(isObject(user), 'User not an object', 13);

  if (!isInteger(Number(credits)) || Number(credits) <= 0) {
    await ctx.redirect('/buy?err=1');
    return next();
  }

  if (Number(credits) + Number(user.credits) > MAXIMUM_CREDITS_ALLOWED) {
    await ctx.redirect('/buy?err=2');
    return next();
  }

  await addCreditsToUser(user, credits);

  await ctx.redirect('/buy?success=1');
});

const addCreditsToUser = async (user, credits) => {
  makeTransaction(async () => {
    await db.query(`
      UPDATE users SET credits = $1 WHERE id = $2`,
      Number(user.credits) + Number(credits),
      user.id
    );
    await db.query(`
      INSERT INTO credit_transfers (user_id, credits_bought, event, transfer_date)
        VALUES ($1, $2, $3, $4)`,
      user.id,
      credits,
      'Credit purchase',
      new Date()
    );
  });
}

// POST admin
router.post('/admin', async (ctx, next) => {
  trace(`POST '/admin'`);

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    ctx.session.admin = true;
    return ctx.redirect('/admin');
  }

  ctx.redirect('/admin?err=1');
});

// POST register
router.post('/register', async (ctx, next) => {
  trace(`POST '/register'`);

  assertUser(
    typeof ctx.request.body.username === 'string' &&
      typeof ctx.request.body.email === 'string' &&
      typeof ctx.request.body.password === 'string' &&
      typeof ctx.request.body['repeat-password'] === 'string',
    'Invalid information',
    20
  );

  const username = ctx.request.body.username;
  const email = ctx.request.body.email.toLowerCase();
  const password = ctx.request.body.password;
  const repeatPassword = ctx.request.body['repeat-password'];

  const salt = generateRandomString(10);

  if (!validateEmail(email)) {
    ctx.redirect('/register?err=2');
    return next();
  }

  if (password !== repeatPassword) {
    ctx.redirect('/register');
    return next();
  }

  if (
    password.length < MINIMUM_PASSWORD_LENGTH ||
      username.length < MINIMUM_USERNAME_LENGTH
  ) {
    ctx.redirect('/register');
    return next();
  }

  const user = (await db.query(`SELECT * FROM users WHERE username = $1 or email = $2`, username, email)).rows[0];

  if (user != null) {
    if (user.username === username) {
      ctx.redirect('/register?err=1'); // username exists
      return next();
    } else {
      ctx.redirect('/register?err=3'); // email exists
      return next();
    }
  }

  const saltedPassword = password + salt;
  const hash = await bcrypt.hash(saltedPassword, 5);

  db.query(
    `INSERT INTO users (date_registered, password, email, username, salt)
      VALUES ($1, $2, $3, $4, $5)`,
    new Date(),
    hash,
    email,
    username,
    salt
  )

  ctx.redirect('/login?success=1');
});

// POST login
router.post('/login', async (ctx, next) => {
  trace(`POST '/login'`);

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  const user = (await db.query(`SELECT * FROM users where username = $1`, username)).rows[0];

  if (user == null) {
    ctx.redirect('/login?err=1');
    return next();
  }

  const saltedPassword = password + user.salt;
  const isPassCorrect = await bcrypt.compare(saltedPassword, user.password);

  if (isPassCorrect) {
    ctx.session.user = user.username;
    ctx.redirect('/home');
  } else {
    ctx.redirect('/login?err=2');
  }
});

// POST generate API key
router.post('/api/generateAPIKey', generateAPIKey);

// GET delete key
router.get('/api/del/:key', deleteAPIKey);

// POST forecast
router.post('/api/forecast', getForecast);

app.use(router.routes());

module.exports = server;
