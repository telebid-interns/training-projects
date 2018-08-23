const Koa = require('koa');
const router = require('koa-router')();
const { assert, assertUser } = require('./../asserts/asserts.js');
const { PeerError, UserError } = require('./../asserts/exceptions.js');
const { trace, clearTraceLog } = require('./../debug/tracer.js');
const {
  generateRandomString,
  validateEmail,
  isObject,
  isInteger,
} = require('./../utils/utils.js');
const db = require('./../database/pg_db.js');
const serve = require('koa-static');
const bcrypt = require('bcrypt');
const views = require('koa-views');
const {
  DEFAULT_PORT,
  MINIMUM_USERNAME_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  MAX_REQUESTS_PER_HOUR,
  MAXIMUM_CREDITS_ALLOWED,
  MERCHANT_ID,
  CREDIT_CARD_PRIVATE_KEY,
  CREDIT_CARD_PUBLIC_KEY,
  SALT_ROUNDS,
  SALT_LENGTH,
  APPROVE_CREDIT_TRANSFER_BOUNDARY
} = require('./../utils/consts.js');
const braintree = require('braintree');

const gateway = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId: MERCHANT_ID,
  publicKey: CREDIT_CARD_PUBLIC_KEY,
  privateKey: CREDIT_CARD_PRIVATE_KEY,
});

const app = new Koa();

// GET root
router.get('/', async (ctx, next) => {
  trace(`GET '/'`);
  db.sql('SELECT * FROM users;');
  console.log('doing srtuff');
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

  const user = (await db.sql(`SELECT * FROM users WHERE username = $1`, ctx.session.user))[0];
  assert(user != null, 'cookie contained username not in database', 10);

  const keys = await db.sql(`SELECT * FROM api_keys WHERE user_id = $1`, user.id);
  assert(Array.isArray(keys), `keys expected to be array but wasn't`, 15);

  await ctx.render(
    'home', {
      user: ctx.session.user,
      credits: user.credits,
      limit: MAX_REQUESTS_PER_HOUR,
      keys,
    }
  );
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

// GET buy
router.get('/buy', async (ctx, next) => {
  trace(`GET '/buy'`);

  if (ctx.session.user == null) {
    ctx.redirect('/login');
    return next();
  }

  const response = await gateway.clientToken.generate();

  await ctx.render('buy', {
    success: ctx.query.success,
    error: ctx.query.err,
    clientToken: response.clientToken,
  });
});

// POST buy
router.post('/buy', async (ctx, next) => {
  trace(`POST '/buy'`);
  assert(isObject(ctx.request.body), 'Post buy has no body', 12);
  assert(ctx.request.body.total != null, 'No total in post buy', 14);
  assert(ctx.request.body.nonce != null, 'No nonce in post buy', 15);
  assert(ctx.request.body.credits != null, 'No credits in post buy', 16);

  const sale = await gateway.transaction.sale({
    amount: ctx.request.body.total,
    paymentMethodNonce: ctx.request.body.nonce,
    options: {
      submitForSettlement: true,
    },
  });

  const credits = ctx.request.body.credits;
  const user = (await db.sql(`SELECT * FROM users WHERE username = $1`, ctx.session.user))[0];
  assert(isObject(user), 'User not an object', 13);

  if (!isInteger(Number(credits)) || Number(credits) <= 0) {
    ctx.body = { error: 'Credits must be a positive whole number' };
    return next();
  }

  if (Number(credits) + Number(user.credits) > MAXIMUM_CREDITS_ALLOWED) {
    ctx.body = { error: 'Maximum credits allowed is 1000000 per user' };
    return next();
  }

  if (sale.success) {
    await purchaseCredits(user, credits);
    if (credits < APPROVE_CREDIT_TRANSFER_BOUNDARY) return ctx.body = {msg: `${credits} credits added to account`};
    ctx.body = {msg: `${credits} credits sent for approval`};
  } else {
    ctx.body = { error: 'Purchase unsuccessful' };
  }
});

const purchaseCredits = async (user, credits) => {
  db.makeTransaction(async (client) => {
    const approved = credits < APPROVE_CREDIT_TRANSFER_BOUNDARY;
    await client.query(`
      INSERT INTO credit_transfers (
          user_id,
          credits_received,
          event,
          transfer_date,
          approved
        )
        VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        credits,
        'Credit purchase',
        new Date(),
        approved
      ]
    );

    if (approved) {
      await client.query(`
        UPDATE users
          SET credits = credits + $1
        WHERE id = $2`,
        [
          Number(credits),
          user.id
        ]
      );
    }
  });
};

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

  const salt = generateRandomString(SALT_LENGTH);

  if (!validateEmail(email)) {
    await ctx.render('register', {
      error: 'Invalid Email',
      username,
      email,
    });
    return next();
  }

  if (password !== repeatPassword) {
    await ctx.render('register', {
      error: 'Passwords must match',
      username,
      email,
    });
    return next();
  }

  if (
    password.length < MINIMUM_PASSWORD_LENGTH ||
      username.length < MINIMUM_USERNAME_LENGTH
  ) {
    await ctx.render('register', {
      error: 'username and password must be around 4 symbols',
      username,
      email,
    });
    return next();
  }

  const user = (await db.sql(`SELECT * FROM users WHERE username = $1 OR email = $2`, username, email))[0];

  if (user != null) {
    if (user.username === username) {
      await ctx.render('register', {
        error: 'a user with this username already exists',
        username,
        email,
      });
      return next();
    } else {
      await ctx.render('register', {
        error: 'a user with this email already exists',
        username,
        email,
      });
      return next();
    }
  }

  const saltedPassword = password + salt;
  const hash = await bcrypt.hash(saltedPassword, SALT_ROUNDS);

  db.sql(
    `INSERT INTO users (date_registered, password, email, username, salt)
      VALUES ($1, $2, $3, $4, $5)`,
    new Date(),
    hash,
    email,
    username,
    salt
  );

  await ctx.render('login', { msg: 'Successfuly Registered' });
});

// POST login
router.post('/login', async (ctx, next) => {
  trace(`POST '/login'`);

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  const user = (await db.sql(`SELECT * FROM users WHERE username = $1`, username))[0];

  if (user == null) {
    await ctx.render('login', { error: 'No user registered with given username' });
    return next();
  }

  const saltedPassword = password + user.salt;
  const isPassCorrect = await bcrypt.compare(saltedPassword, user.password);

  if (isPassCorrect) {
    ctx.session.user = user.username;
    ctx.redirect('/home');
  } else {
    await ctx.render('login', { error: 'Invalid Password' });
  }
});

app.use(router.routes());

module.exports = app;
