const sqlite = require('sqlite');
const api = require('./api.js');
const asserts = require('./../asserts/asserts.js');
const { trace } = require('./../debug/tracer.js');
const { isObject } = require('./../utils/utils.js');
const db = require('./../database/db.js');

updateDB();

async function updateDB () {
  trace(`Function updateDB`);
  const reports = await db.select(`reports`, {}, {});
  resetAPIKeys();

  for (const report of reports) {
    if (!report.city) {
      continue;
    }

    let forecast;

    try {
      forecast = await api.getWeatherAPIData(report.city);
    } catch (err) {
      console.error(err);
      continue;
    }

    asserts.assertPeer(
      isObject(forecast.city) &&
      isObject(forecast.city.coord),
      'API responded with wrong data');

    db.update(`reports`, {
      country_code: forecast.city.country,
      lat: forecast.city.coord.lat,
      lng: forecast.city.coord.lon,
      observed_at: new Date()
    }, {
      city: forecast.city.name
    });

    const dbForecast = await db.select(`reports`, { city: report.city }, { one: true });

    for (const report of forecast.list) {
      asserts.assertPeer(
        Array.isArray(report.weather) &&
        isObject(report.clouds) &&
        isObject(report.main) &&
        isObject(report.wind),
        'API responded with wrong data');

      // "Unique on conflict replace" takes care of updating
      db.insert(`weather_conditions`, {
          report_id: dbForecast.id,
          weather: report.weather[0].main,
          weather_description: report.weather[0].description,
          cloudiness: report.clouds.all,
          humidity: report.main.humidity,
          max_temperature: report.main.temp_max,
          min_temperature: report.main.temp_min,
          sea_pressure: report.main.sea_level,
          ground_pressure: report.main.grnd_level,
          wind_direction: report.wind.deg,
          wind_speed: report.wind.speed,
          date: new Date(report.dt_txt)
        });
    }
  }
}

function resetAPIKeys () {
  trace(`Function resetAPIKeys`);
  db.update(`api_keys`, { use_count: 0 }, {});
}
