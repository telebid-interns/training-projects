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
const db = require('./../database/pg_db.js');

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
    db.insert(`api_keys`, {
      key,
      user_id: user.id
    });
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

  // addToUserRequestCount(user, true); // hack.. TODO fix

  const response = {};

  const key = ctx.request.body.key;
  let iataCode = ctx.request.body.iataCode;
  let cityName = ctx.request.body.city;
  // TODO assert peer
  assertUser(
    typeof cityName === 'string' ||
    typeof iataCode === 'string',
    'No city or iataCode in post body'
  );
  assertUser(typeof ctx.request.body.key === 'string', 'No API key in post body');

  if (
    typeof cityName !== 'string' &&
    typeof iataCode === 'string'
  ) {
    iataCode = iataCode.toLowerCase();
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
    typeof cityName === 'string' &&
    typeof iataCode !== 'string'
    ) {
    // TODO to lower inline, trim etc
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

  // TODO get result
  await updateAPIKeyUsage(keyRecord);

  if (city == null) {
    db.insert(`cities`, { name: cityName });
    throw new UserError('no information found, please try again later');
  }

  const conditions = await db.select(`weather_conditions`, {city_id: city.id}, {});

  assertUser(conditions.length !== 0, 'no information found, please try again later');

  response.observed_at = city.observed_at;
  response.city = city.name;
  response.country_code = city.country_code;
  response.lng = city.lng;
  response.lat = city.lat;
  response.conditions = conditions;

  const user = await db.select(`users`, { id: keyRecord.user_id }, { one: true });

  addToUserRequestCount(user, false);
  updateRequests(iataCode, cityName);

  ctx.body = response;
}

const updateAPIKeyUsage = (keyRecord) => {
  // transaction ?
  return db.update(`api_keys`, { use_count: keyRecord.use_count + 1 }, { id: keyRecord.id });
}

const updateRequests = async (iataCode, city) => {
  const selectWhere = {};

  if (typeof iataCode === 'string') {
    selectWhere.iata_code = iataCode;
  } else {
    selectWhere.city = city;
  }
  const request = await db.select(`requests`, selectWhere, { one: true });

  if (request == null){
    db.insert(`requests`, selectWhere);
  } else {
    db.update(`requests`, { call_count: request.call_count + 1}, selectWhere);
  }
}

const addToUserRequestCount = (user, failedRequest) => {
  if (failedRequest) {
    db.update(`users`, { failed_requests: user.failed_requests + 1 }, { id: user.id });
  } else {
    db.update(`users`, {
      successful_requests: user.successful_requests + 1,
      failed_requests: user.failed_requests - 1
    }, { id: user.id });
  }
}

module.exports = {
    getWeatherAPIData,
    getForecast,
    generateAPIKey,
    deleteAPIKey
  };
