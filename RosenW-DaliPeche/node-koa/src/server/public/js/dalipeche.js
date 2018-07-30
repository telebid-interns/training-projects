const API_LINK = 'http://127.0.0.1/api/forecast';

$.fn.getForecastByCity = async function (city, key) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ city, key }),
  };

  const response = await fetch(API_LINK, options);

  return response.json();
};

$.fn.getForecastByIATACode = async function (iataCode, key) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ iataCode, key }),
  };

  const response = await fetch(API_LINK, options);

  return response.json();
};
