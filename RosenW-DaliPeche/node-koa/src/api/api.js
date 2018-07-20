const requester = require('request-promise');
const API_KEY = '3324c849124277736f1fefdc58dfc561';
const FORECAST_API_LINK = 'https://api.openweathermap.org/data/2.5/forecast';

async function getForecast (city) {
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

module.exports = { getForecast };
