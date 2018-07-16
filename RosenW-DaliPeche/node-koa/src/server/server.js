const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const asserts = require('./../asserts/asserts.js');
const sqlite = require('sqlite');

const PORT = 3001;
const NO_INFO_MSG = 'error: no information for requested city, please try again later';
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
  const city = ctx.request.body.city;
  const response = {};
  const report = await db.get(`select * from reports as r where r.city = ?`, city);

  if (report == null) {
    ctx.body = {message: NO_INFO_MSG};
    db.run(`insert into reports (city) values(?)`, city);
    return;
  }

  let conditions = await db.all(`
      select * from weather_conditions as wc
      where wc.report_id = ?`,
      report.id
  );

  if (conditions.length === 0) {
    ctx.body = {message: NO_INFO_MSG};
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
