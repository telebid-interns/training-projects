const Koa = require('koa');
const Router = require('koa-router');
const { assert } = require('./../asserts/asserts.js');
const { trace } = require('./../debug/tracer.js');
const {
  generateRandomString,
  isObject,
  isInteger
} = require('./../utils/utils.js');
const Database = require('./../database/db.js');
const db = Database('pg');
const serve = require('koa-static');
const bcrypt = require('bcrypt');
const session = require('koa-session');
const views = require('koa-views');
const bodyParser = require('koa-bodyparser');
const {
  DEFAULT_PORT,
  MAX_REQUESTS_PER_HOUR,
  MAXIMUM_CREDITS_ALLOWED,
  ROWS_PER_PAGE,
  MINIMUM_USERNAME_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  SALT_ROUNDS,
  SALT_LENGTH,
} = require('./../utils/consts.js');
const paths = require('./../etc/config.js');

const app = new Koa();

if (require.main === module) {
  router = new Router({
    prefix: `${paths.backOfficeMountPoint}`
  });
  const server = app.listen(DEFAULT_PORT, () => {
    console.log(`Backoffice Server listening on port: ${DEFAULT_PORT}`);
  });
  app.use(serve(`${__dirname}/public/css`));
  app.use(serve(`${__dirname}/public/js`));

  app.use(views(`${__dirname}/views`, {
    extension: 'hbs',
    map: { hbs: 'handlebars' }, // marks engine for extensions
    options: {
      partials: {
        adminForm: `./admin_form`, // requires ./admin_form.hbs
      },
    },
  }));

  app.keys = ['DaliKrieTaini'];

  // (cookie lifetime): (Milliseconds)
  app.use(session({ maxAge: 1000 * 60 * 60 * 24 }, app));

  // Error Handling
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof UserError) {
        ctx.body = {
          message: err.message,
          statusCode: err.statusCode,
        };
      } else if (err instanceof PeerError) {
        ctx.body = {
          message: err.message,
          statusCode: err.statusCode,
        };
      } else {
        console.log(err);
        console.log(`Application Error: ${err.message}, Status code: ${err.statusCode}`);
        ctx.body = 'An error occured please clear your cookies and try again';
      }
    }
  });

  app.use(bodyParser());
} else {
  router = new Router();
}

// GET
router.get('/', async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}'`);
  if (ctx.session.admin == null) {
    await ctx.render('admin_login');
    return next();
  }

  await ctx.render('admin');
});

// GET users
router.get(paths.users, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.backOfficeUsers}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_users) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
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

  dateTo.setDate(dateTo.getDate() + 1); // include chosen day

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

  dateTo.setDate(dateTo.getDate() - 1); // show original date

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
    dateTo: dateTo.toISOString().substr(0, 10),
    permissions: ctx.session.permissions
  });
});

// GET credits
router.get(paths.creditBalance, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.creditBalance}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_credit_balance) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
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

// GET cities
router.get(paths.cities, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.cities}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_cities) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
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
    countryCode,
  });
});

// GET requests
router.get(paths.requests, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.requests}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_requests) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
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
  )).sort((c1, c2) => c2.call_count - c1.call_count)
    .map((r) => {
      const request = r.city ? r.city : r.iata_code;
      const type = r.city ? 'City' : 'Airport IATA Code';
      return {
        request,
        type,
        call_count: r.call_count
      }
  });

  await ctx.render('admin_requests', {
    requests,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    term,
  });
});

// GET create user
router.get(paths.backOfficeCreateUser, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.backOfficeCreateUser}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_edit_backoffice_users) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
    return next();
  }

  const roles = await db.sql(`SELECT * FROM roles ORDER BY id`);

  await ctx.render('admin_create_user', { roles });
});

// POST create user
router.post(paths.backOfficeCreateUser, async (ctx, next) => {
  trace(`POST '${paths.backOfficeMountPoint}/${paths.backOfficeCreateUser}'`);

  assert(
    typeof ctx.request.body.username === 'string' &&
    typeof ctx.request.body.password === 'string' &&
    typeof ctx.request.body['repeat-password'] === 'string',
    typeof ctx.request.body['select-role'] === 'string',
    'Invalid information',
    199
  );

  const role = ctx.request.body['select-role'];
  const username = ctx.request.body.username;
  const password = ctx.request.body.password;
  const repeatPassword = ctx.request.body['repeat-password'];

  const salt = generateRandomString(SALT_LENGTH);

  if (password !== repeatPassword) {
    await ctx.render('admin_create_user', {
      error: 'Passwords must match',
      username,
    });
    return next();
  }

  if (
    password.length < MINIMUM_PASSWORD_LENGTH ||
      username.length < MINIMUM_USERNAME_LENGTH
  ) {
    await ctx.render('admin_create_user', {
      error: 'username and password must be at least 3 symbols',
      username,
    });
    return next();
  }

  const user = (await db.sql(`SELECT * FROM backoffice_users WHERE username = $1`, username))[0];

  if (user != null && user.username === username) {
    await ctx.render('admin_create_user', {
      error: 'a user with this username already exists',
      username,
    });
    return next();
  }

  const saltedPassword = password + salt;
  const hash = await bcrypt.hash(saltedPassword, SALT_ROUNDS);

  const newRecord = (await db.sql(
    `INSERT INTO backoffice_users (password, username, salt)
      VALUES ($1, $2, $3)
      RETURNING id`,
    hash,
    username,
    salt
  ))[0];

  await db.sql(`
    INSERT INTO backoffice_users_roles (backoffice_user_id, role_id)
      VALUES ($1, $2)`,
    newRecord.id,
    role
  );

  await ctx.render('admin', {msg: 'Successfuly Registered User'});
});

// GET roles
router.get(paths.roles, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.roles}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_roles) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
    return next();
  }

  const roles = await db.sql(`SELECT * FROM roles ORDER BY id`);

  const msg = ctx.session.msg != null ? ctx.session.msg : '';
  delete ctx.session.msg;

  await ctx.render('admin_roles', {
    roles,
    permissions: ctx.session.permissions,
    msg
  });
});

// DELETE role
router.del('/role', async (ctx, next) => {
  trace(`DELETE '/del'`);

  const role = ctx.request.body.role;

  try {
    await db.sql(`DELETE FROM roles WHERE role = $1`, role);
    ctx.body = { msg: 'Successfuly deleted role' };
  } catch (err) {
    console.log(err);
    ctx.body = { err: `Deletion failed: Some users are still assigned to this role` };
  }
});

// GET backoffice-users
router.get(paths.backOfficeUsers, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.backOfficeUsers}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_backoffice_users) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
    return next();
  }

  const term = ctx.query.term == null ? '' : ctx.query.term;
  const page = !Number(ctx.query.page) || ctx.query.page < 0 ? 0 : Number(ctx.query.page);

  const roles = await db.sql(`SELECT id, role FROM roles ORDER BY id`);

  const users = (await db.sql(`
    SELECT bu.id, bu.username, r.role, r.id as role_id
      FROM backoffice_users as bu
    JOIN backoffice_users_roles as bur
      ON bu.id = bur.backoffice_user_id
    JOIN roles as r
      ON r.id = bur.role_id
    WHERE
      LOWER(username) LIKE LOWER($1)
    ORDER BY bu.id
    OFFSET $2
    LIMIT $3`,
  `%${term}%`,
  0 + (ROWS_PER_PAGE * page),
  ROWS_PER_PAGE
  )).sort((c1, c2) => c2.call_count - c1.call_count);

  const msg = ctx.session.msg != null ? ctx.session.msg : '';
  delete ctx.session.msg;

  await ctx.render('admin_backoffice_users', {
    users,
    roles,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    term,
    permissions: ctx.session.permissions,
    msg
  });
});

// POST backoffice-users
router.post(paths.backOfficeUsers, async (ctx, next) => {
  assert(isObject(ctx.session), 'No session in post /backoffice-users', 192);
  assert(isObject(ctx.session.permissions), 'No permissions in post /backoffice-users', 193);

  if (!ctx.session.permissions.can_edit_backoffice_users) {
    ctx.redirect(`/${paths.backOfficeMountPoint}/${paths.roles}`);
    return;
  }

  assert(isObject(ctx.request.body), 'Post /backoffice-users has no body', 194);

  const roleId = ctx.request.body['select-role'];
  const userId = ctx.request.body.id;

  assert(typeof roleId === 'string', 'Post /backoffice-users body has no roleId', 195);
  assert(typeof userId === 'string', 'Post /backoffice-users has no userId', 196);

  await db.sql(`
    UPDATE backoffice_users_roles
      SET
        role_id = $1
      WHERE
        backoffice_user_id = $2
  `,
  roleId,
  userId
  );

  ctx.session.msg = `Successfuly updated user's role`;
  ctx.redirect(`/${paths.backOfficeMountPoint}/${paths.backOfficeUsers}`);
});

// POST add-role
router.post('/add-role', async (ctx, next) => {
  if (!ctx.session.permissions.can_change_role_permissions) {
    ctx.body = {err: `You don't have permission to add a role`}
    return;
  }

  db.sql(`INSERT INTO roles (role) VALUES ('')`);
  ctx.body = {msg: `Successfuly added new role`};
});

// GET ctransfers
router.get(paths.creditTransfers, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.creditTransfers}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_transfers) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
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

  dateTo.setDate(dateTo.getDate() + 1); // include chosen day

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
        AND (ct.transfer_date BETWEEN $3 AND $4)
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

  const total = (await db.sql(`
    SELECT
      SUM(credits_received) as total_received,
      SUM(credits_spent) as total_spent
    FROM users AS u
    JOIN credit_transfers as ct
      ON ct.user_id = u.id
    WHERE
      UNACCENT(LOWER(username)) LIKE LOWER($1)
      AND LOWER(event) LIKE LOWER($2)
      AND (ct.transfer_date BETWEEN $3 AND $4)
      AND approved = true`,
  `%${username}%`,
  `%${event}%`,
  dateFrom,
  dateTo
  ))[0];

  dateTo.setDate(dateTo.getDate() - 1); // show original date

  await ctx.render('admin_transfers', {
    transfers,
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    username,
    event,
    dateFrom: dateFrom.toISOString().substr(0, 10),
    dateTo: dateTo.toISOString().substr(0, 10),
    total
  });
});

// POST add credits
router.post('/addCreditsToUser', async (ctx, next) => {
  assert(isObject(ctx.request.body), 'Post /addCredits has no body', 19);

  if (!ctx.session.permissions.can_add_credits) {
    return;
  }

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
router.post(paths.approveTransfers, async (ctx, next) => {
  assert(isObject(ctx.session), 'No session in post /approve', 180);
  assert(isObject(ctx.session.permissions), 'No permissions in post /approve', 181);

  if (!ctx.session.permissions.can_approve_credits) {
    return;
  }

  assert(isObject(ctx.request.body), 'Post /approve has no body', 103);
  assert(typeof ctx.request.body.id === 'string' && isInteger(Number(ctx.request.body.id)), 'Post /approve body has no id', 104);

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

  ctx.body = {isApproveSuccessful: true};
});

// POST roles
router.post(paths.roles, async (ctx, next) => {
  assert(isObject(ctx.session), 'No session in post /roles', 182);
  assert(isObject(ctx.session.permissions), 'No permissions in post /roles', 183);

  if (!ctx.session.permissions.can_change_role_permissions) {
    ctx.redirect(`/${paths.backOfficeMountPoint}/${paths.roles}`);
    return;
  }

  assert(isObject(ctx.request.body), 'Post /roles has no body', 184);
  assert(typeof ctx.request.body.role === 'string', 'Post /roles body has no role', 185);

  const role = ctx.request.body.role;
  const oldRole = ctx.request.body['old-role'];
  const seeUsers = ctx.request.body.can_see_users === 'on';
  const addCredits = ctx.request.body.can_add_credits === 'on';
  const seeTransfers = ctx.request.body.can_see_transfers === 'on';
  const seeCities = ctx.request.body.can_see_cities === 'on';
  const seeRequests = ctx.request.body.can_see_requests === 'on';
  const seeBalance = ctx.request.body.can_see_credit_balance === 'on';
  const seeApproval = ctx.request.body.can_see_credits_for_approval === 'on';
  const canApprove = ctx.request.body.can_approve_credits === 'on';
  const seeRoles = ctx.request.body.can_see_roles === 'on';
  const changePermissions = ctx.request.body.can_change_role_permissions === 'on';
  const editBackofficeUsers = ctx.request.body.can_edit_backoffice_users === 'on';
  const seeBackofficeUsers = ctx.request.body.can_see_backoffice_users === 'on';

  await db.sql(`
    UPDATE roles
      SET
        role = $14,
        can_see_users = $1,
        can_add_credits = $2,
        can_see_transfers = $3,
        can_see_cities = $4,
        can_see_requests = $5,
        can_see_credit_balance = $6,
        can_see_credits_for_approval = $7,
        can_approve_credits = $8,
        can_see_roles = $9,
        can_change_role_permissions = $10,
        can_see_backoffice_users = $11,
        can_edit_backoffice_users = $12
      WHERE
        role = $13
    `,
    seeUsers,
    addCredits,
    seeTransfers,
    seeCities,
    seeRequests,
    seeBalance,
    seeApproval,
    canApprove,
    seeRoles,
    changePermissions,
    seeBackofficeUsers,
    editBackofficeUsers,
    oldRole,
    role
  );

  ctx.session.msg = `Successfuly Changed the ${oldRole} Role`;
  await ctx.redirect(`/${paths.backOfficeMountPoint}/${paths.roles}`);
});

// POST admin
router.post('/', async (ctx, next) => {
  trace(`POST '/${paths.backOfficeMountPoint}'`);

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
    ctx.session.permissions = (await db.sql(`
      SELECT * FROM roles AS r
        JOIN backoffice_users_roles AS ur
        ON r.id = ur.role_id
        JOIN backoffice_users AS u
        ON u.id = ur.backoffice_user_id
        WHERE u.username = $1;
      `, username
    ))[0];

    assert(isObject(ctx.session.permissions), 'Post /admin user has no permissions', 112);
    return ctx.redirect(`${paths.backOfficeMountPoint}`);
  }

  await ctx.render('/admin_login', { error: 'Invalid log in information' });
});

// GET approve
router.get(paths.approveTransfers, async (ctx, next) => {
  trace(`GET '/${paths.backOfficeMountPoint}/${paths.approveTransfers}'`);

  if (!isObject(ctx.session.permissions) || !ctx.session.permissions.can_see_credits_for_approval) {
    await ctx.redirect(`${paths.backOfficeMountPoint}`);
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
    permissions: ctx.session.permissions
  });
});

// GET logout
router.get(paths.backOfficeLogout, async (ctx, next) => {
  trace(`GET '${paths.backOfficeMountPoint}/${paths.backOfficeLogout}'`);

  ctx.session = null;
  await ctx.redirect(`${paths.backOfficeMountPoint}`);
});

app.use(router.routes());

module.exports = app;
