const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const {
  assert,
  assertUser,
  assertPeer,
} = require('./../asserts/asserts.js');
const sqlite = require('sqlite');
const serve = require('koa-static');
const bcrypt = require('bcrypt');
const session = require('koa-session');
const views = require('koa-views');
const path = require('path');
const requester = require('request-promise');

const PORT = 3001;

const NO_INFO_MSG = 'error: no information for requested city, please try again later';
const NO_KEY_IN_REQUEST_MSG = 'error: incorrect api key';
const USED_ALL_REQUESTS_MSG = 'error: you have exceeded your request cap, please try again later';

const MINIMUM_USERNAME_LENGTH = 3;
const MINIMUM_PASSWORD_LENGTH = 3;

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

const AIRPORT_API_LINK = 'http://www.airport-data.com/api/ap_info.json';

const MAX_REQUESTS_PER_HOUR = 10;

const app = new Koa();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`);
});

app.keys = ['DaliKrieTaini'];

// (cookie lifetime): (Milliseconds)
app.use(session({ maxAge: 1000 * 60 * 60 * 24 }, app));

app.use(serve(path.join(__dirname, '/public/css')));
app.use(serve(path.join(__dirname, '/public/js')));

app.use(views(path.join(__dirname, '/views'), {
  extension: 'hbs', // looks for .html on removal
  map: { hbs: 'handlebars' }, // hbs specifies engine, "Engine not found for the ".hbs" file extension" on removal
}));

app.use(router.routes());
app.use(router.allowedMethods());

app.use(bodyParser());

let db;

async function connect () {
  db = await sqlite.open('./src/database/forecast.db');
}

connect();

// GET root
router.get('/', async (ctx, next) => {
  await ctx.redirect('/home');
});

// GET logout
router.get('/logout', async (ctx, next) => {
  ctx.session = null; // docs: "To destroy a session simply set it to null"
  await ctx.redirect('/login');
});

// GET docs
router.get('/docs', async (ctx, next) => {
  await ctx.render('docs');
});

// GET example
router.get('/example', async (ctx, next) => {
  await ctx.render('example');
});

// GET home
router.get('/home', async (ctx, next) => {
  if (ctx.session.user == null) {
    ctx.redirect('/login');
    return;
  }

  const user = await db.get('SELECT * FROM accounts WHERE username = ?', ctx.session.user);

  if (user == null) {
    ctx.redirect('/login');
  }

  const keys = await db.all('SELECT * FROM apikeys WHERE account_id = ?', user.id);

  await ctx.render(
    'home',
    {
      user: ctx.session.user,
      requests: user.request_count,
      limit: MAX_REQUESTS_PER_HOUR,
      keys,
    });
});

// GET login
router.get('/login', async (ctx, next) => {
  if (ctx.session.user != null) {
    ctx.redirect('/home');
  }
  await ctx.render('login', {err: ctx.query.err});
});

// GET register
router.get('/register', async (ctx, next) => {
  if (ctx.session.user != null) {
    ctx.redirect('/home');
  }
  await ctx.render('register', {err: ctx.query.err});
});

// GET admin
router.get('/admin', async (ctx, next) => {
  if (ctx.session.admin == null) {
    await ctx.render('admin_login');
  } else {
    let users;
    if (ctx.query.term == null) {
      users = await db.all(`SELECT * FROM accounts`);
    } else {
      const term = `%${ctx.query.term}%`;
      users = await db.all(`
          SELECT
            username,
            request_count,
            date_registered
          FROM accounts
          WHERE username LIKE ?`,
      term
      );
    }

    await ctx.render('admin', {
      users,
      maxRequests: MAX_REQUESTS_PER_HOUR,
    });
  }
});

// POST admin
router.post('/admin', async (ctx, next) => {
  await next();

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    ctx.session.admin = true;
  }

  ctx.redirect('/admin');
});

// POST register
router.post('/register', async (ctx, next) => {
  await next();

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;
  const repeatPassword = ctx.request.body['repeat-password'];

  const salt = generateRandomString(10);

  const account = await db.get('SELECT * FROM accounts WHERE username = ?', username);

  if (password !== repeatPassword) {
    ctx.redirect('/register');
    return; // TODO return next();
  }

  if (
      password.length < MINIMUM_PASSWORD_LENGTH ||
      username.length < MINIMUM_USERNAME_LENGTH
  ) {
    ctx.redirect('/register');
    return;
  }

  if (account != null) {
    ctx.redirect('/register?err=1');
    return;
  }
  // TODO change to saltedPass
  bcrypt.hash(password + salt, 5, (err, hash) => {
    db.run(`
        INSERT INTO accounts (
            username,
            password,
            salt,
            request_count,
            date_registered
          )
        VALUES (?, ?, ?, 0, ?)`,
    username,
    hash,
    salt,
    formatDate(new Date())
    );
  });

  ctx.redirect('/login');
});

// POST login
router.post('/login', async (ctx, next) => {
  await next();

  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  const user = await db.get('SELECT * FROM accounts WHERE username = ?', username);

  if (user == null) {
    ctx.redirect('/login?err=1');
    return;
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

// TODO /api/generateApiKey?
router.post('/generateKey', async (ctx, next) => {
  await next();

  const user = ctx.request.body.name;
  const key = generateRandomString(16);
  const account = await db.get('SELECT * FROM accounts WHERE username = ?', user);

  if (account == null) { // assert
    ctx.body = 'User not found'; // make hash
    return;
  }

  db.run('INSERT INTO apikeys (key, account_id) VALUES (?, ?)', key, account.id);
  ctx.body = { key };
});

// POST forecast
router.post('/api/forecast', async (ctx, next) => {
  await next();

  assertUser(
    typeof ctx.request.body.city === 'string' ||
    typeof ctx.request.body.iataCode === 'string',
    'No city or iataCode in post body'
  );
  assertUser(typeof ctx.request.body.key === 'string', 'No apikey in post body');

  const response = {};

  const iataCode = ctx.request.body.iataCode;
  const key = ctx.request.body.key;
  let city = ctx.request.body.city;

  if (
    typeof ctx.request.body.city !== 'string' &&
    typeof ctx.request.body.iataCode === 'string'
  ) {
    const options = {
      uri: AIRPORT_API_LINK,
      qs: {
        iata: iataCode,
      },
      headers: {
        'User-Agent': 'Request-Promise',
      },
      json: true, // Automatically parses the JSON string in the response
    };

    const data = await requester(options);

    assertPeer(
      isObject(data) &&
      typeof data.location === 'string',
      'API responded with wrong data'
    );

    city = data.location.split(',')[0];
  } else if (
    typeof ctx.request.body.city === 'string' &&
    typeof ctx.request.body.iataCode !== 'string'
    ) {
    city = cityNameToPascal(city);
  }

  const report = await db.get(`SELECT * FROM reports WHERE city = ?`, city);
  const keyRecord = await db.get(`SELECT * FROM apikeys WHERE key = ?`, key);

  if (keyRecord == null || typeof keyRecord !== 'object') {
    ctx.body = {
      message: NO_KEY_IN_REQUEST_MSG, // dont use const
      statusCode: 10,
    };
    return; // ?
  }

  const account = await db.get(`SELECT * FROM accounts WHERE id = ?`, keyRecord.account_id);

  const accRequestCount = account.request_count;

  if (accRequestCount >= MAX_REQUESTS_PER_HOUR) {
    ctx.body = {
      message: USED_ALL_REQUESTS_MSG,
      statusCode: 11,
    };
    return;
  }

  // should be function, lock ?
  db.run(`UPDATE accounts SET request_count = ? WHERE id = ?`, accRequestCount + 1, account.id);

  if (report == null) { // move up
    ctx.body = {
      message: NO_INFO_MSG,
      statusCode: 12,
    };
    db.run(`INSERT INTO reports (city) VALUES (?)`, city);
    return;
  }

  let conditions = await db.all(`
    SELECT * FROM weather_conditions AS wc
    WHERE wc.report_id = ?`,
  report.id
  );

  // filters dates before now, cant compare dates in db
  conditions = conditions.filter((c) => {
    return c.date > new Date().getTime();
  });
  conditions = conditions.map((c) => {
    c.date = new Date(parseInt(c.date));
    return c;
  });

  if (conditions.length === 0) {
    ctx.body = {
      message: NO_INFO_MSG,
      statusCode: 12,
    };
    return;
  }

  response.observed_at = new Date(report.observed_at);
  response.city = report.city;
  response.country_code = report.country_code;
  response.lng = report.lng;
  response.lat = report.lat;
  response.conditions = conditions;

  ctx.body = response;
});

function generateRandomString (length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

function isObject (obj) {
  return typeof obj === 'object' && obj != null;
}

function formatDate (date) {
  const year = date.getFullYear();
  let month = `${date.getMonth() + 1}`; // months start FROM 0
  let day = `${date.getDate()}`;

  if (month.length < 2) month = `0${month}`;
  if (day.length < 2) day = `0${day}`;

  return [day, month, year].join('-');
}

function cityNameToPascal (city) {
  const newCityName = [];
  const cityTokens = city.split(' ');

  for (const token of cityTokens) {
    newCityName.push(token.substr(0, 1).toUpperCase() + token.substr(1, token.length));
  }

  return newCityName.join(' ');
}

module.exports = server;
