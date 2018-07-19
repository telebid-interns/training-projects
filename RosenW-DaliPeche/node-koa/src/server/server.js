const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const asserts = require('./../asserts/asserts.js'); // TODO destruct
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

const MAX_REQUESTS_PER_HOUR = 60;

const app = new Koa();

// TODO app.error()

const server = app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`);
});

app.keys = ['DaliPecheTaina'];


// TODO fix ms
app.use(session({ maxAge: 86400000 }, app));

app.use(serve(path.join(__dirname, '/public/css')));
app.use(serve(`${__dirname}/public/js`)); // TODO use path

app.use(views(__dirname + '/views', { // TODO use path
  extension: 'hbs',
  map: { hbs: 'handlebars' }
}));

app.use(router.routes());
app.use(router.allowedMethods());

app.use(bodyParser());

let db;

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

  user = await db.get('select * from accounts where username = ?', ctx.session.user);

  if (user == null) {
    ctx.redirect('/login');
  }

  keys = await db.all('select * from apikeys where account_id = ?', user.id);

  await ctx.render(
    'home',
    {
      user: ctx.session.user,
      requests: user.request_count,
      limit: MAX_REQUESTS_PER_HOUR,
      keys
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

// POST register
router.post('/register', bodyParser(), async (ctx, next) => {
  const username = ctx.request.body.username;
  const password = ctx.request.body.password;
  const repeatPassword = ctx.request.body['repeat-password'];

  const salt = generateRandomString(10);

  const account = await db.get('select * from accounts where username = ?', username);

  if (password !== repeatPassword) {
    ctx.redirect('/register');
    return;
  }

  if (password.length < 3 || username.length < 3) {
    ctx.redirect('/register');
    return;
  }

  if (account != null) {
    ctx.redirect('/register?err=1');
    return;
  }


  bcrypt.hash(password + salt, 5, (err, hash) => {
    db.run('insert into accounts (username, password, salt, request_count) values(?, ?, ?, 0)', username, hash, salt);
  });
  ctx.redirect('/login');
});

// POST login
router.post('/login', bodyParser(), async (ctx, next) => {
  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  const user = await db.get('select * from accounts where username = ?', username);

  if (user == null) {
    ctx.redirect('/login?err=1');
    return;
  }

  const correct = await bcrypt.compare(password + user.salt, user.password);

  if(correct){
    ctx.session.user = user.username;
    ctx.redirect('/home');
  } else {
    ctx.redirect('/login?err=2');
  }
});

router.post('/generateKey', bodyParser(), async (ctx, next) => {
  const user = ctx.request.body.name;
  const key = generateRandomString(16);
  const account = await db.get('select * from accounts where username = ?', user);
  if (account == null) {
    ctx.body = 'User not found';
    return;
  }
  db.run('insert into apikeys (key, account_id) values(?, ?)', key, account.id);
  ctx.body = { key };
});

// POST forecast
router.post('/api/forecast', bodyParser(), async (ctx, next) => {
  asserts.assertUser(typeof ctx.request.body.city === 'string' || typeof ctx.request.body.iataCode === 'string', 'No city in post body');
  asserts.assertUser(typeof ctx.request.body.key === 'string', 'No apikey in post body');

  // http://www.airport-data.com/api/ap_info.json?icao=KJFK

  const response = {};

  let city = ctx.request.body.city;
  const iataCode = ctx.request.body.iataCode;
  const key = ctx.request.body.key;

  if (
      typeof ctx.request.body.city !== 'string' &&
      typeof ctx.request.body.iataCode === 'string'
    ) {
    const options = {
      uri: 'http://www.airport-data.com/api/ap_info.json',
      qs: {
        iata: iataCode
      },
      headers: {
        'User-Agent': 'Request-Promise',
      },
      json: true, // Automatically parses the JSON string in the response
    };

    const data = await requester(options);
    asserts.assertPeer(
      isObject(data) &&
      typeof data.location === 'string',
      'API responded with wrong data'
      );
    city = data.location.split(',')[0];
  }

  const report = await db.get(`select * from reports where city = ?`, city);
  const keyRecord = await db.get(`select * from apikeys where key = ?`, key);

  if (keyRecord == null || typeof keyRecord !== 'object') {
    ctx.body = { message: NO_KEY_IN_REQUEST_MSG }; // TODO add status code
    return;
  }

  const account = await db.get(`select * from accounts where id = ?`, keyRecord.account_id);

  const accRequestCount = account.request_count;

  if (accRequestCount >= MAX_REQUESTS_PER_HOUR) {
    ctx.body = { message: USED_ALL_REQUESTS_MSG };
    return;
  }

  db.run(`update accounts set request_count = ? where id = ?`, accRequestCount + 1, account.id);

  if (report == null) {
    ctx.body = { message: NO_INFO_MSG };
    db.run(`insert into reports (city) values(?)`, city);
    return;
  }

  let conditions = await db.all(`
    select * from weather_conditions as wc
    where wc.report_id = ?`,
    report.id
  );

  if (conditions.length === 0) {
    ctx.body = { message: NO_INFO_MSG };
    return;
  }

  // filters dates before now, cant compare dates in db
  conditions = conditions.filter((c) => {
    return Date.parse(c.date) > new Date().getTime();
  });

  response.observed_at = report.observed_at;
  response.city = report.city;
  response.country_code = report.country_code;
  response.lng = report.lng;
  response.lat = report.lat;
  response.conditions = conditions;

  ctx.body = response;
});

async function connect () {
  db = await sqlite.open('./src/database/forecast.db');
}

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

module.exports = server;
