const sqlite = require('sqlite');
const api = require('./api.js');
const asserts = require('./../asserts/asserts.js');

updateDB();

// TODO error handling
async function updateDB () {
  const db = await sqlite.open('./../database/forecast.db');
  const reports = await db.all(`select id, city from reports`);

  for (const report of reports) {
    if (!report.city) {
      continue;
    }

    let forecast;

    try {
      forecast = await api.getForecast(report.city);
    } catch (err) {
      console.error(err);
      continue;
    }

    asserts.assertPeer(
      isObject(forecast.city) &&
      isObject(forecast.city.coord),
      'API responded with wrong data');

    db.run(`
      update reports
      set
        country_code=?,
        lat=?,
        lng=?,
        observed_at=?
      where city=?`,
    forecast.city.country,
    forecast.city.coord.lat,
    forecast.city.coord.lon,
    new Date().toString(),
    forecast.city.name);

    const dbForecast = await db.get(`select id from reports where city = ?`, report.city);

    for (const report of forecast.list) {
      asserts.assertPeer(
        Array.isArray(report.weather) &&
        isObject(report.clouds) &&
        isObject(report.main) &&
        isObject(report.wind),
        'API responded with wrong data');

      // "Unique on conflict replace" takes care of updating
      db.run(`
        insert into weather_conditions (
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
        values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        report.dt_txt
      );
    }
  }
}

function isObject (obj) {
  return typeof obj === 'object' && obj != null;
}
