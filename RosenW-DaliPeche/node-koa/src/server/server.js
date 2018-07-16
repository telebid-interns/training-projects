const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const asserts = require('./../asserts/asserts.js');
const sqlite = require('sqlite');

const PORT = 3001;

const NO_INFO_MSG = 'error: no information for requested city, please try again later';
const NO_KEY_IN_REQUEST_MSG = 'error: incorrect api key';
const USED_ALL_REQUESTS_MSG = 'error: you have exceeded your request cap, please try again later';

const app = new Koa();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`);
});

app.use(router.routes());
app.use(router.allowedMethods());

app.use(bodyParser());

let db;

connect();

router.post('/forecast', bodyParser(), async (ctx, next) => {
  asserts.assertUser(typeof ctx.request.body.city === 'string', 'No city in post body');
  asserts.assertUser(typeof ctx.request.body.key === 'string', 'No apikey in post body');

  const response = {};

  const city = ctx.request.body.city;
  const key = ctx.request.body.key;

  const report = await db.get(`select * from reports where city = ?`, city);
  const keyRecord = await db.get(`select * from apikeys where key = ?`, key);

  if (keyRecord == null || typeof keyRecord !== 'object') {
    ctx.body = { message: NO_KEY_IN_REQUEST_MSG };
    return;
  }

  if (keyRecord.use_count >= 10) {
    ctx.body = { message: USED_ALL_REQUESTS_MSG };
    return;
  }

  db.run(`update apikeys set use_count = ? where key = ?`, keyRecord.use_count + 1, key);

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

module.exports = server;
