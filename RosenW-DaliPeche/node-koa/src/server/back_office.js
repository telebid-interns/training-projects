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
const session = require('koa-session');
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
  ROWS_PER_PAGE,
  APPROVE_CREDIT_TRANSFER_BOUNDARY
} = require('./../utils/consts.js');
const braintree = require('braintree');
const api = require('./../api/api.js');

const gateway = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId: MERCHANT_ID,
  publicKey: CREDIT_CARD_PUBLIC_KEY,
  privateKey: CREDIT_CARD_PRIVATE_KEY,
});

const app = new Koa();

// GET /
router.get('/', async (ctx, next) => {
  trace(`GET '/admin'`);
  if (ctx.session.admin == null) {
    await ctx.render('admin_login');
    return next();
  }

  await ctx.render('admin');
});

// GET /users
router.get('/users', async (ctx, next) => {
  trace(`GET '/admin/users'`);

  if (!Array.isArray(ctx.session.roles) || !ctx.session.roles.includes('superuser'))
  {
    await ctx.redirect('/admin');
    return next();
  }

  const username = ctx.query.username == null ? '' : ctx.query.username;
  const email = ctx.query.email == null ? '' : ctx.query.email;
  const creditsFrom = ctx.query['credits-from'] == null ? 0 : Number(ctx.query['credits-from']);
  const creditsTo = ctx.query['credits-to'] == null || Number(ctx.query['credits-to']) === 0 ? MAXIMUM_CREDITS_ALLOWED : Number(ctx.query['credits-to']);
  const dateFrom = ctx.query['date-from'] == null || isNaN(new Date(ctx.query['date-from'])) ? new Date('1970-01-01') : new Date(ctx.query['date-from']);
  const dateTo = ctx.query['date-to'] == null || isNaN(new Date(ctx.query['date-to'])) ? new Date() : new Date(ctx.query['date-to']);

  assert(typeof username === 'string', `in 'admin/user' username expected to be string, actual: ${username}`, 121);
  assert(isObject(dateFrom), `in 'admin/user' dateFrom expected to be object. actual: ${dateFrom}`, 122);
  assert(isObject(dateTo), `in 'admin/user' dateTo expected to be object. actual: ${dateTo}`, 123);
  assert(typeof email === 'string', `in 'admin/user' email expected to be string, actual: ${email}`, 124);
  assert(typeof creditsFrom === 'number', `in 'admin/user' creditsFrom expected to be number, actual: ${creditsFrom}`, 125);
  assert(typeof creditsTo === 'number', `in 'admin/user' creditsTo expected to be number, actual: ${creditsTo}`, 126);

  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);

  const users = (await db.sql(`
    SELECT * FROM users
    WHERE
      UNACCENT(LOWER(username)) LIKE LOWER($1)
      AND LOWER(email) LIKE LOWER($2)
      AND (date_registered BETWEEN $3 AND $4)
      AND (credits BETWEEN $5 AND $6)
    ORDER BY id
    OFFSET $7
    LIMIT $8`,
  `%${username}%`,
  `%${email}%`,
  dateFrom,
  dateTo,
  creditsFrom,
  creditsTo,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  )).map((u) => {
    u.date_registered = u.date_registered.toISOString();
    return u;
  });

  await ctx.render('admin_users', {
    maxRequests: MAX_REQUESTS_PER_HOUR,
    users,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    username,
    email,
    creditsFrom,
    creditsTo,
    dateFrom: dateFrom.toISOString().substr(0, 10),
    dateTo: dateTo.toISOString().substr(0, 10)
  });
});

// GET /credits
router.get('/credits', async (ctx, next) => {
  trace(`GET '/admin/credits'`);

  if (
      !Array.isArray(ctx.session.roles) ||
      !ctx.session.roles.includes('superuser') &&
      !ctx.session.roles.includes('accountant'))
  {
    await ctx.redirect('/admin');
    return next();
  }

  const username = ctx.query.username == null ? '' : ctx.query.username;
  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);
  const users = await db.sql(`
    SELECT
      u.id,
      u.username,
      SUM(ct.credits_received) AS credits_purchased,
      SUM(ct.credits_spent) AS credits_spent,
      u.credits AS credits_remaining
    FROM users AS u
    JOIN credit_transfers AS ct
    ON ct.user_id = u.id
    WHERE UNACCENT(LOWER(u.username)) LIKE LOWER($1)
    GROUP BY (u.id, u.username, u.credits)
    ORDER BY u.id
    OFFSET $2
    LIMIT $3
  `,
    `%${username}%`,
    0 + (ROWS_PER_PAGE * page),
    ROWS_PER_PAGE
  );

  const total = (await db.sql(`
    SELECT
      SUM(credits_purchased) AS total_credits_purchased,
      SUM(credits_spent) AS total_credits_spent,
      SUM(credits_remaining) AS total_credits_remaining
    FROM (
      SELECT
        u.id,
        u.username,
        SUM(ct.credits_received) AS credits_purchased,
        SUM(ct.credits_spent) AS credits_spent,
        u.credits AS credits_remaining
      FROM users AS u
      JOIN credit_transfers AS ct
      ON ct.user_id = u.id
      WHERE UNACCENT(LOWER(u.username)) LIKE LOWER($1)
      GROUP BY (u.id, u.username, u.credits)
      ORDER BY u.id
      OFFSET $2
      LIMIT $3) AS total_by_user;
    `,
  `%${username}%`,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  ))[0];

  await ctx.render('admin_credits', {
    users,
    total_credits_purchased: total.total_credits_purchased,
    total_credits_spent: total.total_credits_spent,
    total_credits_remaining: total.total_credits_remaining,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    username,
  });
});

// GET /cities
router.get('/cities', async (ctx, next) => {
  trace(`GET '/admin/cities'`);

  assert(Array.isArray(ctx.session.roles), `roles not array in admin/cities`, 162);
  if (!Array.isArray(ctx.session.roles) || !ctx.session.roles.includes('superuser')) {
    await ctx.redirect('/admin');
    return next();
  }

  const name = ctx.query.name == null ? '' : ctx.query.name;
  const countryCode = ctx.query['country-code'] == null ? '' : ctx.query['country-code'];

  assert(typeof name === 'string', `in 'admin/cities' name expected to be string, actual: ${name}`, 141);
  assert(typeof countryCode === 'string', `in 'admin/cities' country-code expected to be string, actual: ${countryCode}`, 142);

  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);

  const cities = (await db.sql(`
    SELECT * FROM cities
    WHERE
      UNACCENT(LOWER(name)) LIKE LOWER($1)
      AND LOWER(country_code) LIKE LOWER($2)
    ORDER BY id
    OFFSET $3
    LIMIT $4`,
  `%${name}%`,
  `%${countryCode}%`,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  )).map((c) => {
    if (c.observed_at != null) c.observed_at = c.observed_at.toISOString();
    return c;
  }).sort((c1, c2) => c1.id - c2.id);

  await ctx.render('admin_cities', {
    cities,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    name,
    countryCode
  });
});

// GET /requests
router.get('/requests', async (ctx, next) => {
  trace(`GET '/admin/requests'`);

  if (!Array.isArray(ctx.session.roles) || !ctx.session.roles.includes('superuser')) {
    await ctx.redirect('/admin');
    return next();
  }

  const term = ctx.query.term == null ? '' : ctx.query.term;
  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);

  const requests = (await db.sql(`
    SELECT * FROM requests
    WHERE
    LOWER(iata_code) LIKE LOWER($1)
    OR UNACCENT(LOWER(city)) LIKE LOWER($1)
    ORDER BY id
    OFFSET $2
    LIMIT $3`,
  `%${term}%`,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  )).sort((c1, c2) => c2.call_count - c1.call_count);

  await ctx.render('admin_requests', {
    requests,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    term,
  });
});

// GET ctransfers
router.get('/ctransfers', async (ctx, next) => {
  trace(`GET '/admin/ctransfers'`);

  if (
      !Array.isArray(ctx.session.roles) ||
      !ctx.session.roles.includes('superuser') &&
      !ctx.session.roles.includes('accountant'))
  {
    await ctx.redirect('/admin');
    return next();
  }

  const username = ctx.query.username == null ? '' : ctx.query.username;
  const dateFrom = ctx.query['date-from'] == null || isNaN(new Date(ctx.query['date-from'])) ? new Date('1970-01-01') : new Date(ctx.query['date-from']);
  const dateTo = ctx.query['date-to'] == null || isNaN(new Date(ctx.query['date-to'])) ? new Date() : new Date(ctx.query['date-to']);
  const event = ctx.query.event == null ? '' : ctx.query.event;

  assert(typeof username === 'string', `in 'admin/ctransfers' username expected to be string, actual: ${username}`, 131);
  assert(isObject(dateFrom), `in 'admin/ctransfers' dateFrom expected to be object. actual: ${dateFrom}`, 132);
  assert(isObject(dateTo), `in 'admin/ctransfers' dateTo expected to be object. actual: ${dateTo}`, 133);
  assert(typeof event === 'string', `in 'admin/ctransfers' event expected to be string, actual: ${event}`, 134);

  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);

  const transfers = (await db.sql(`
      SELECT
        ct.id,
        transfer_date,
        username,
        credits_received,
        credits_spent,
        event
      FROM users AS u
      JOIN credit_transfers as ct
        ON ct.user_id = u.id
      WHERE
        UNACCENT(LOWER(username)) LIKE LOWER($1)
        AND LOWER(event) LIKE LOWER($2)
        AND (date_registered BETWEEN $3 AND $4)
        AND approved = true
      ORDER BY ct.id DESC
      OFFSET $5
      LIMIT $6`,
  `%${username}%`,
  `%${event}%`,
  dateFrom,
  dateTo,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  )).map((t) => {
    t.transfer_date = t.transfer_date.toISOString();
    return t;
  });

  await ctx.render('admin_transfers', {
    transfers,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    username,
    event,
    dateFrom: dateFrom.toISOString().substr(0, 10),
    dateTo: dateTo.toISOString().substr(0, 10)
  });
});

// POST add credits
router.post('/addCreditsToUser', async (ctx, next) => {
  assert(isObject(ctx.request.body), 'Post /addCredits has no body', 19);

  const username = ctx.request.body.username;
  const credits = ctx.request.body.credits;

  assert(username != null, 'No username in post /addCredits', 101);
  assert(credits != null, 'No credits in post /addCredits', 102);

  if (credits > 1000000) {
    ctx.body = { err: 'Credits Must be under 1,000,000' };
  }

  await db.makeTransaction(async (client) => {
    const user = (await client.query(`SELECT * FROM users WHERE username = $1`, [ username ])).rows[0];
    await client.query(`
      UPDATE users SET credits = $1 WHERE username = $2`,
    [
      Number(user.credits) + Number(credits),
      username,
    ]
    );
    await client.query(`
      INSERT INTO credit_transfers (user_id, credits_received, event, transfer_date)
        VALUES ($1, $2, $3, $4)
    `,
    [
      user.id,
      credits,
      `Credits given by admin: ${ctx.session.username}`,
      new Date(),
    ]
    );
  });
  ctx.body = { msg: `Successfuly added ${credits} credits to user ${username}}` };
});

// POST approve transfer
router.post('/approve', async (ctx, next) => {
  assert(isObject(ctx.request.body), 'Post /approve has no body', 103);
  assert(typeof ctx.request.body.id === 'string' && Number(ctx.request.body.id), 'Post /approve body has no id', 104);

  const id = ctx.request.body.id;

  assert(id != null, 'No id in post /approve', 105);

  await db.makeTransaction(async (client) => {
    const transfer = (await client.query('SELECT * FROM credit_transfers WHERE id = $1', [ id ])).rows[0];
    assert(isObject(transfer), 'Post /approve transfer not found', 106);
    const user = (await client.query('SELECT * FROM users WHERE id = $1', [ transfer.user_id ])).rows[0];
    assert(isObject(user), 'Post /approve user not found', 107);
    await client.query(`UPDATE users SET credits = $1 WHERE id = $2`, [ Number(transfer.credits_received) + Number(user.credits), transfer.user_id ]);
    await client.query(`UPDATE credit_transfers SET approved = true WHERE id = $1`, [ transfer.id ]);
  });
  ctx.body = '';
});

// POST admin
router.post('/', async (ctx, next) => {
  trace(`POST '/admin'`);

  assert(isObject(ctx.request.body), 'Post /admin has no body', 108);

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  assert(typeof ctx.request.body.username === 'string', 'Post /admin body has no username', 109);
  assert(typeof ctx.request.body.password === 'string', 'Post /admin body has no password', 110);

  const user = (await db.sql(`
    SELECT u.salt, u.password FROM roles AS r
      JOIN backoffice_users_roles AS ur
      ON r.id = ur.role_id
      JOIN backoffice_users AS u
      ON u.id = ur.backoffice_user_id
      WHERE u.username = $1;
    `, username
  ))[0];
  assert(isObject(user), 'Post /admin user not found', 111);

  if (user == null) {
    await ctx.render('admin_login', { error: 'Invalid log in information' });
    return next();
  }

  const saltedPassword = password + user.salt;
  const isPassCorrect = await bcrypt.compare(saltedPassword, user.password);

  if (isPassCorrect) {
    ctx.session.admin = true;
    ctx.session.username = username;
    ctx.session.roles = (await db.sql(`
      SELECT r.role FROM roles AS r
        JOIN backoffice_users_roles AS ur
        ON r.id = ur.role_id
        JOIN backoffice_users AS u
        ON u.id = ur.backoffice_user_id
        WHERE u.username = $1;
      `, username
    )).map((r) => r.role);
    assert(isObject(ctx.session.roles), 'Post /admin user has no roles', 112);
    return ctx.redirect('/admin');
  }

  await ctx.render('/admin_login', { error: 'Invalid log in information' });
});

// GET /approve
router.get('/approve', async (ctx, next) => {
  trace(`GET '/admin/approve'`);

  if (!Array.isArray(ctx.session.roles) || !ctx.session.roles.includes('superuser')) {
    await ctx.redirect('/admin');
    return next();
  }

  const username = ctx.query.username == null ? '' : ctx.query.username;
  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);

  const transfers = (await db.sql(`
    SELECT
      ct.id,
      u.username,
      ct.credits_received
    FROM users as u
    JOIN credit_transfers as ct
    ON ct.user_id = u.id
    WHERE
      UNACCENT(LOWER(u.username)) LIKE LOWER($1) AND
      approved = false
    ORDER BY ct.id DESC
    OFFSET $2
    LIMIT $3`,
  `%${username}%`,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  ));
  await ctx.render('admin_approve', {
    transfers,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    username,
  });
});

app.use(router.routes());

module.exports = app;

