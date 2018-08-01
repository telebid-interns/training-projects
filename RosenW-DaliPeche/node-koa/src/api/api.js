const requester = require('request-promise');
const { trace } = require('./../debug/tracer.js');
const { assert, assertPeer, assertUser } = require('./../asserts/asserts.js');
const { UserError, PeerError } = require('./../asserts/exceptions.js');
const { generateRandomString, isObject, cityNameToPascal, makeTransaction } = require('./../utils/utils.js');
const {
  MAX_API_KEYS_PER_USER,
  MAX_REQUESTS_PER_HOUR,
  AIRPORT_API_LINK,
  CREDITS_FOR_SUCCESSFUL_REQUEST,
  CREDITS_FOR_FAILED_REQUEST
} = require('./../utils/consts.js');
const db = require('./../database/pg_db.js');

const generateAPIKey = async (ctx, next) => {
  trace(`POST '/generateKey'`);

  const username = ctx.request.body.name;
  const key = generateRandomString(16);
  const user = (await db.query(`SELECT * FROM users WHERE username = $1`, username)).rows[0];
  // const user = await db.select(`users`, { username }, { one: true });

  assert(user != null, 'User not found when generating API key', 11);

  const APIKeyCountData = (await db.query(`SELECT COUNT(*) FROM api_keys WHERE user_id = $1`, user.id)).rows[0];
  // const APIKeyCountData = await db.select('api_keys', { user_id: user.id }, { one: true, count: true });

  if (APIKeyCountData.count >= MAX_API_KEYS_PER_USER) {
    ctx.body = { msg: 'API key limit exceeded' };
  } else {
    db.insert(`api_keys`, {
      key,
      user_id: user.id,
    });
    ctx.body = { key };
  }
};

const deleteAPIKey = async (ctx, next) => {
  trace(`GET '/api/del/:key'`);

  const key = ctx.params.key;

  await db.query(`DELETE FROM api_keys WHERE key = $1`, key);
  // await db.del(`api_keys`, { key });
  ctx.redirect('/home');
};

const getForecast = async (ctx, next) => {
  trace(`POST '/api/forecast'`);

  assertPeer(isObject(ctx.request.body), 'No request body provided', 38);

  const response = {};
  const key = ctx.request.body.key;

  let iataCode = ctx.request.body.iataCode;
  let cityName = ctx.request.body.city;

  assertPeer(typeof key === 'string', 'No API key in post body', 31);

  const keyRecord = (await db.query(`SELECT * FROM api_keys WHERE key = $1`, key)).rows[0];
  // const keyRecord = await db.select(`api_keys`, { key }, { one: true });
  assertPeer(isObject(keyRecord), 'invalid API key', 33);

  const user = (await db.query(`SELECT * FROM users WHERE id = $1`, keyRecord.user_id)).rows[0];
  // const user = await db.select(`users`, { id: keyRecord.user_id }, { one: true });
  assert(isObject(user), 'No user found when searching by api key', 13);

  try {
    await updateAPIKeyUsage(keyRecord);

    assertPeer(
      typeof cityName === 'string' ||
      typeof iataCode === 'string',
      'No city or iataCode in post body',
      30
    );

    // if only iatacode is given
    if (typeof cityName !== 'string' && typeof iataCode === 'string') {
      iataCode = iataCode.toLowerCase().trim();
      cityName = await getCityByIATACode(iataCode);
    }

    cityName = cityName.toLowerCase().trim();

    const city = (await db.query(`SELECT * FROM cities WHERE name = $1`, cityName)).rows[0];
    // const city = await db.select(`cities`, { name: cityName }, { one: true });
    assertPeer(isObject(city), 'no information found, please try again later', 39);

    const conditions = (await db.query(`SELECT * FROM weather_conditions WHERE city_id = $1`, city.id)).rows;
    // const conditions = await db.select(`weather_conditions`, {city_id: city.id}, {});
    assert(Array.isArray(conditions), `expected conditions to be array but wasn't`, 14);
    assertPeer(conditions.length > 0, 'no information found, please try again later', 34);

    response.observed_at = city.observed_at;
    response.city = city.name;
    response.country_code = city.country_code;
    response.lng = city.lng;
    response.lat = city.lat;
    response.conditions = conditions;
  } catch (err) {
    if (err.statusCode === 39) db.insert(`cities`, { name: cityName });
    await taxUser(user, true);
    throw err;
  }

  await taxUser(user, false);
  await updateRequests(iataCode, cityName);

  ctx.body = response;
};

const updateAPIKeyUsage = async (keyRecord) => {
  assertPeer(
    keyRecord.use_count < MAX_REQUESTS_PER_HOUR,
    'you have exceeded your request cap, please try again later',
    35
  )

  await db.query(`UPDATE api_keys SET use_count = $1 WHERE id = $2`, keyRecord.use_count + 1, keyRecord.id);
  // await db.update(`api_keys`, { use_count: keyRecord.use_count + 1 }, { id: keyRecord.id });
};

const updateRequests = async (iataCode, city) => {
  const whereKey = iataCode === 'string' ? 'iata_code' : 'city';
  const whereValue = iataCode === 'string' ? iataCode : city;

  const request = (await db.query(`SELECT * FROM requests WHERE $1 = $2`, whereKey, whereValue)).rows[0];
  // const request = await db.select(`requests`, selectWhere, { one: true });

  if (request == null) {
    await db.query(`INSERT INTO requests ($1) VALUES ($2)`, whereKey, whereValue);
    // await db.insert(`requests`, selectWhere);
  } else {
    await db.query(`UPDATE requests SET call_count = $1 WHERE $2 = $3`, request.call_count + 1, whereKey, whereValue);
    // await db.update(`requests`, { call_count: request.call_count + 1 }, selectWhere);
  }
};

const taxUser = async (user, isFailedRequest) => {
  makeTransaction(async () => {
    assertPeer(user.credits >= CREDITS_FOR_SUCCESSFUL_REQUEST, `Not enough credits to make a request`, 300);
    let updateData;
    const requestsKey = isFailedRequest ? 'failed_requests' : 'successful_requests';
    const requestsValue = isFailedRequest ? user.failed_requests + 1 : user.successful_requests + 1;
    const credits = isFailedRequest ? CREDITS_FOR_FAILED_REQUEST : CREDITS_FOR_SUCCESSFUL_REQUEST;

    await db.query(`UPDATE users SET $1 = $2, credits = $3 WHERE id = $4`, requestsKey, requestsValue, credits, user.id );
    // await db.update(`users`, updateData, { id: user.id });

    await saveTransfer(user, isFailedRequest);
  });
};

const saveTransfer = async (user, isFailedRequest) => {
  await db.insert('credit_transfers', {
    user_id: user.id,
    credits_spent: isFailedRequest ? CREDITS_FOR_FAILED_REQUEST : CREDITS_FOR_SUCCESSFUL_REQUEST,
    event: isFailedRequest ? 'Failed request' : 'Successful request',
    transfer_date: new Date()
  });
}

const getCityByIATACode = async (iataCode) => {
    iataCode = iataCode.toLowerCase();
    const options = {
      uri: AIRPORT_API_LINK,
      qs: {
        iata: iataCode,
      },
      headers: {
        'User-Agent': 'Request-Promise',
        'Access-Control-Allow-Origin': '*'
      },
      json: true, // Automatically parses the JSON string in the response
    };
    const data = await requester(options);

    if (!isObject(data) || typeof data.location !== 'string') {
      throw new PeerError('Could not find city based on given iata code', 32);
    }

    return data.location.split(',')[0];
}


module.exports = {
  getForecast,
  generateAPIKey,
  deleteAPIKey,
};
