const DALI_PECHE_LINK = 'http://10.20.1.137:3001/api/forecast';

$.fn.getForecastByCity = async function(city, key) {
  const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ city, key })
    }

  const response = await fetch(DALI_PECHE_LINK, options);

  return response.json();
};

$.fn.getForecastByIATACode = async function(iataCode, key) {
  const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ iataCode, key })
    }

  const response = await fetch(DALI_PECHE_LINK, options);

  return response.json();
};
