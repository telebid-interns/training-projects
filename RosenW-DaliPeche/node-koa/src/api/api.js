const requester = require('request-promise');
const { trace } = require('./../debug/tracer.js');
const API_KEY = '3324c849124277736f1fefdc58dfc561';
const db = require('./../database/db.js');
const { assert, assertUser, assertPeer } = require('./../asserts/asserts.js');
const { generateRandomString, isObject, formatDate, cityNameToPascal } = require('./../utils/utils.js');

const FORECAST_API_LINK = 'https://api.openweathermap.org/data/2.5/forecast';
const MAX_API_KEYS_PER_USER = 5;

db.connect();

const getWeatherAPIData = async (city) => {
  trace(`Function getWeatherAPIData`);

  const options = {
    uri: FORECAST_API_LINK,
    qs: {
      q: city,
      units: 'metric',
      appid: API_KEY,
    },
    headers: {
      'User-Agent': 'Request-Promise',
    },
    json: true, // Automatically parses the JSON string in the response
  };

  return requester(options);
}

const generateAPIKey = async (ctx, next) => {
  trace(`POST '/generateKey'`);

  const username = ctx.request.body.name;
  const key = generateRandomString(16);
  const user = await db.select(`users`, { username }, { one: true });

  assert(user != null, 'User not found');

  const APIKeyCountData = await db.select('api_keys', { user_id: user.id }, { one: true, count: true } );
  console.log(APIKeyCountData);

  if (APIKeyCountData.count >= MAX_API_KEYS_PER_USER) {
    ctx.body = { msg: 'API key limit exceeded' };
  } else {
    db.insert(`api_keys`, { key, user_id: user.id });
    ctx.body = { key };
  }
}

const deleteAPIKey = async (ctx, next) => {
  trace(`GET '/api/del/:key'`);

  const key = ctx.params.key;

  await db.del(`api_keys`, { key });
  ctx.redirect('/home');
}

const getForecast = async (ctx, next) => {
  trace(`POST '/api/forecast'`);

  assertUser(
    typeof ctx.request.body.city === 'string' ||
    typeof ctx.request.body.iataCode === 'string',
    'No city or iataCode in post body'
  );
  assertUser(typeof ctx.request.body.key === 'string', 'No API key in post body');

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
  const keyRecord = await db.get(`SELECT * FROM api_keys WHERE key = ?`, key);

  assertUser(
      keyRecord != null &&
      typeof keyRecord === 'object',
      'invalid API key'
    );

  assertUser(
      keyRecord.use_count < MAX_REQUESTS_PER_HOUR,
      'you have exceeded your request cap, please try again later'
    );

  // should be function, lock ?
  db.run(`UPDATE api_keys SET use_count = ? WHERE id = ?`, keyRecord.use_count + 1, keyRecord.id);

  if (report == null) {
    db.run(`INSERT INTO reports (city) VALUES (?)`, city);
    throw new UserError('no information for requested city, please try again later');
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

  assertUser(conditions.length !== 0, 'no information for requested city, please try again later');

  response.observed_at = new Date(report.observed_at);
  response.city = report.city;
  response.country_code = report.country_code;
  response.lng = report.lng;
  response.lat = report.lat;
  response.conditions = conditions;

  ctx.body = response;
}

module.exports = { getWeatherAPIData, getForecast, generateAPIKey, deleteAPIKey };
