const sqlite = require('sqlite');
const api = require('./api.js');
const asserts = require('./../asserts/asserts.js');
const { trace } = require('./../debug/tracer.js');
const { isObject } = require('./../utils/utils.js');

updateDB();

async function updateDB () {
  trace(`Function updateDB`);

  const db = await sqlite.open('./../database/forecast.db');
  const reports = await db.all(`SELECT id, city FROM reports`);
  resetAPIKeys(db);

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

    db.run(`
      UPDATE reports
      SET
        country_code=?,
        lat=?,
        lng=?,
        observed_at=?
      WHERE city=?`,
    forecast.city.country,
    forecast.city.coord.lat,
    forecast.city.coord.lon,
    new Date(),
    forecast.city.name);

    const dbForecast = await db.get(`SELECT id FROM reports WHERE city = ?`, report.city);

    for (const report of forecast.list) {
      asserts.assertPeer(
        Array.isArray(report.weather) &&
        isObject(report.clouds) &&
        isObject(report.main) &&
        isObject(report.wind),
        'API responded with wrong data');

      // "Unique on conflict replace" takes care of updating
      db.run(`
        INSERT INTO weather_conditions (
          report_id,
          weather,
          weather_description,
          cloudiness,
          humidity,
          max_temperature,
          min_temperature,
          sea_pressure,
          ground_pressure,
          wind_direction,
          wind_speed,
          date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      dbForecast.id,
      report.weather[0].main,
      report.weather[0].description,
      report.clouds.all,
      report.main.humidity,
      report.main.temp_max,
      report.main.temp_min,
      report.main.sea_level,
      report.main.grnd_level,
      report.wind.deg,
      report.wind.speed,
      new Date(report.dt_txt)
      );
    }
  }
}

function resetAPIKeys (db) {
  trace(`Function resetAPIKeys`);

  db.run(`UPDATE api_keys SET use_count = 0`);
}
