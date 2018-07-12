const rp = require('request-promise');
const API_KEY = '3324c849124277736f1fefdc58dfc561';

async function getForecast (city) {
	const options = {
	    uri: 'https://api.openweathermap.org/data/2.5/forecast',
	    qs: {
	    	q: city,
	    	units: 'metric',
	        appid: API_KEY
	    },
	    headers: {
	        'User-Agent': 'Request-Promise'
	    },
	    json: true // Automatically parses the JSON string in the response
	};

	return await rp(options);
}

module.exports = { getForecast };
