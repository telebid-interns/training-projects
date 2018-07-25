const requester = require('request-promise');
const { trace } = require('./../debug/tracer.js');
const { assert, assertUser, assertPeer } = require('./../asserts/asserts.js');
const { AppError, PeerError, UserError } = require('./../asserts/exceptions.js');
const { generateRandomString, isObject, formatDate, cityNameToPascal } = require('./../utils/utils.js');
const {
    FORECAST_API_LINK,
    FORECAST_API_KEY,
    MAX_API_KEYS_PER_USER,
    MAX_REQUESTS_PER_HOUR,
    AIRPORT_API_LINK
  } = require('./../utils/consts.js');
const db = require('./../database/db.js');

const getWeatherAPIData = async (city) => {
  trace(`Function getWeatherAPIData`);

  const options = {
    uri: FORECAST_API_LINK,
    qs: {
      q: city,
      units: 'metric',
      appid: FORECAST_API_KEY,
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
  let cityName = ctx.request.body.city;

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

    cityName = data.location.split(',')[0];
  } else if (
    typeof ctx.request.body.city === 'string' &&
    typeof ctx.request.body.iataCode !== 'string'
    ) {
    cityName = cityNameToPascal(cityName);
  }

  const city = await db.select(`cities`, { name: cityName }, { one: true });
  const keyRecord = await db.select(`api_keys`, { key }, { one: true });

  assertUser(
      keyRecord != null &&
      typeof keyRecord === 'object',
      'invalid API key'
    );

  assertUser(
      keyRecord.use_count < MAX_REQUESTS_PER_HOUR,
      'you have exceeded your request cap, please try again later'
    );

  // should be function, lock ? also replace with wrapper when wrapper done
  db.update(`api_keys`, { use_count: keyRecord.use_count + 1 }, { id: keyRecord.id });

  if (city == null) {
    db.insert(`cities`, { name: cityName });
    throw new UserError('no information for requested city, please try again later');
  }

  let conditions = await db.select(`weather_conditions`, {city_id: city.id}, {});

  // filters dates before now, cant compare dates in db
  conditions = conditions.filter((c) => {
    return c.forecast_time > new Date().getTime();
  });

  conditions = conditions.map((c) => {
    c.forecast_time = new Date(parseInt(c.forecast_time));
    return c;
  });

  assertUser(conditions.length !== 0, 'no information for requested city, please try again later');

  response.observed_at = new Date(parseInt(city.observed_at));
  response.city = city.city;
  response.country_code = city.country_code;
  response.lng = city.lng;
  response.lat = city.lat;
  response.conditions = conditions;

  ctx.body = response;
}

const updateAPIKeyUsage = () => {

}

module.exports = {
    getWeatherAPIData,
    getForecast,
    generateAPIKey,
    deleteAPIKey
  };
