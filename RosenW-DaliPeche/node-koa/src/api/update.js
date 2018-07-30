const { assertPeer } = require('./../asserts/asserts.js');
const { isObject } = require('./../utils/utils.js');
const db = require('./../database/pg_db.js');
const requester = require('request-promise');
const {
  FORECAST_API_LINK,
  FORECAST_API_KEY,
} = require('./../utils/consts.js');

updateDB();

async function updateDB () {
  const cities = await db.select(`cities`, {}, {});
  resetAPIKeys();

  for (const city of cities) {
    if (!city.name) {
      continue;
    }

    let forecast;

    try {
      forecast = await getWeatherAPIData(city.name);
    } catch (err) {
      console.error(err);
      continue;
    }

    console.log(forecast.list.length);

    assertPeer(
      isObject(forecast.city) &&
        isObject(forecast.city.coord),
      'API responded with wrong data'
    );

    db.update(`cities`, {
      country_code: forecast.city.country,
      lat: forecast.city.coord.lat,
      lng: forecast.city.coord.lon,
      observed_at: new Date(),
    }, {
      name: city.name,
    });

    const dbCity = await db.select(`cities`, { name: city.name }, { one: true });

    db.del(`weather_conditions`, { city_id: dbCity.id });

    for (const city of forecast.list) {
      assertPeer(
        Array.isArray(city.weather) &&
          isObject(city.clouds) &&
          isObject(city.main) &&
          isObject(city.wind),
        'API responded with wrong data'
      );

      await db.insert(`weather_conditions`, {
        city_id: dbCity.id,
        weather: city.weather[0].main,
        weather_description: city.weather[0].description,
        cloudiness: city.clouds.all,
        humidity: city.main.humidity,
        max_temperature: city.main.temp_max,
        min_temperature: city.main.temp_min,
        sea_pressure: city.main.sea_level,
        ground_pressure: city.main.grnd_level,
        wind_direction: city.wind.deg,
        wind_speed: city.wind.speed,
        forecast_time: new Date(city.dt_txt),
      });
    }
  }

  db.close();
}

function resetAPIKeys () {
  db.update(`api_keys`, { use_count: 0 }, {});
}

async function getWeatherAPIData (city) {
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
};
