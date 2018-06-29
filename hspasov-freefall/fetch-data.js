(async () => {
  const { fromUnixTimestamp, toKiwiAPIDateFormat, today, dateMonthsFromNow } = require('./modules/date-format');
  const { dbConnect, select, createNewDataFetch } = require('./modules/db');
  const { requestJSON } = require('./modules/request');
  const { assertApp, assertPeer } = require('./modules/error-handling');
  const isObject = require('./modules/is-object');

  await dbConnect();
  const subscriptions = await select('subscriptions', ['id', 'fly_from', 'fly_to']);
  console.log('subscriptions:', subscriptions);

  // const result = await insert(
  //   'airports',
  //   ['iata_code', 'name', 'data_fetch_id'],
  //   [
  //     ['HND', 'Haneda', 1],
  //     ['PAR', 'Paris', 1]
  //   ]
  // );

  const newFetchResult = await createNewDataFetch();
  console.log(newFetchResult.stmt.lastID);

  // TODO use JSON validator

  // GET airlines
  const airlines = await requestJSON('https://api.skypicker.com/airlines');
  console.log('airlines:');

  const iataCodePattern = /^[A-Z0-9]+$/;
  for (const airline of airlines) {
    assertPeer(
      isObject(airline) &&
      typeof airline.id === 'string' &&
      typeof airline.name === 'string' &&
      (iataCodePattern.test(airline.id) || airline.id === '__'), // '__' is 'FakeAirline'
      'API sent invalid airlines response.'
    );

    // ignore '__', it is 'FakeAirline', stored in Kiwi API
    if (airline.id === '__') {
      continue;
    }

    console.log('iata_code:', airline.id);
    console.log('name:', airline.name);
    console.log('logo_url:', `https://images.kiwi.com/airlines/64/${airline.id}.png`);
  }

  // GET routes

  Promise.all(subscriptions.map((sub) => {
    assertApp(
      isObject(sub) &&
      Number.isInteger(sub.id) &&
      typeof sub.fly_from === 'string' &&
      typeof sub.fly_to === 'string',
      'Invalid subscription data.'
    );

    return requestJSON('https://api.skypicker.com/flights', {
      flyFrom: sub.fly_from,
      to: sub.fly_to,
      dateFrom: toKiwiAPIDateFormat(today()),
      dateTo: toKiwiAPIDateFormat(dateMonthsFromNow(3)),
      typeFlight: 'oneway',
      partner: 'picky',
      v: '2',
      xml: '0',
      locale: 'en',
      offset: '0',
      limit: '30'
    }).then((response) => {
      console.log('response:');

      assertPeer(
        isObject(response) &&
        Array.isArray(response.data) &&
        typeof response.currency === 'string',
        'API sent invalid data response.'
      );

      for (const data of response.data) {
        assertPeer(
          isObject(data) &&
          typeof data.booking_token === 'string' &&
          Number.isInteger(data.price) &&
          Array.isArray(data.route),
          'API sent invalid route response.'
        );

        console.log('route:');
        console.log('booking_token:', data.booking_token);
        console.log('subscription_id:', sub.id);
        console.log('price:', data.price);
        console.log('currency:', response.currency);
        console.log('data_fetch_id:...');

        console.log('flights:');

        for (const flight of data.route) {
          assertPeer(
            isObject(flight) &&
            Number.isInteger(flight.flight_no) &&
            Number.isInteger(flight.aTimeUTC) &&
            Number.isInteger(flight.dTimeUTC) &&
            (flight.return === 0 || flight.return === 1) &&
            typeof flight.flyFrom === 'string' &&
            typeof flight.flyTo === 'string' &&
            typeof flight.airline === 'string' &&
            typeof flight.id === 'string',
            'API sent invalid flight response.'
          );

          console.log('flight:');
          console.log('id:', flight.id);
          console.log('airline:', flight.airline);
          console.log('flyFrom:', flight.flyFrom);
          console.log('flyTo:', flight.flyTo);
          console.log('is_return:', flight.return);
          console.log('dtime:', fromUnixTimestamp(flight.dTimeUTC));
          console.log('atime:', fromUnixTimestamp(flight.aTimeUTC));
          console.log('flight_number:', flight.flight_no);
        }
      }
    });
  }));
})();
