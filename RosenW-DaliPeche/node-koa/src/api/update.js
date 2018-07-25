const sqlite = require('sqlite');
const api = require('./api.js');
const asserts = require('./../asserts/asserts.js');
const { trace } = require('./../debug/tracer.js');
const { isObject } = require('./../utils/utils.js');
const db = require('./../database/db.js');

updateDB();

async function updateDB () {
  trace(`Function updateDB`);
  const cities = await db.select(`cities`, {}, {});
  resetAPIKeys();

  for (const city of cities) {
    if (!city.name) {
      continue;
    }

    let forecast;

    try {
      forecast = await api.getWeatherAPIData(city.name);
    } catch (err) {
      console.error(err);
      continue;
    }

    asserts.assertPeer(
        isObject(forecast.city) &&
        isObject(forecast.city.coord),
        'API responded with wrong data'
      );

    db.update(`cities`, {
      country_code: forecast.city.country,
      lat: forecast.city.coord.lat,
      lng: forecast.city.coord.lon,
      observed_at: new Date()
    }, {
      name: forecast.city.name
    });

    const dbCity = await db.select(`cities`, { name: city.name }, { one: true });

    for (const city of forecast.list) {
      asserts.assertPeer(
        Array.isArray(city.weather) &&
        isObject(city.clouds) &&
        isObject(city.main) &&
        isObject(city.wind),
        'API responded with wrong data');

      // "Unique on conflict replace" takes care of updating
      db.insert(`weather_conditions`, {
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
          forecast_time: new Date(city.dt_txt)
        });
    }
  }
}

function resetAPIKeys () {
  trace(`Function resetAPIKeys`);
  db.update(`api_keys`, { use_count: 0 }, {});
}
