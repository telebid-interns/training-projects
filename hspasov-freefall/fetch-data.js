(async () => {
  const { fromUnixTimestamp, toKiwiAPIDateFormat, today, dateMonthsFromNow } = require('./modules/date-format');
  const { dbConnect, select, insertDataFetch, insertRoute, insertOrGetFlight, insertRouteFlight, selectAirport, insertIfNotExistsAirline } = require('./modules/db');
  const { requestJSON } = require('./modules/request');
  const { assertApp, assertPeer } = require('./modules/error-handling');
  const isObject = require('./modules/is-object');

  await dbConnect();
  const subscriptions = await select('subscriptions', ['id', 'airport_from_id', 'airport_to_id']);

  // TODO use JSON validator

  // GET airlines
  const airlines = await requestJSON('https://api.skypicker.com/airlines');
  const iataCodePattern = /^[A-Z0-9]+$/;

  await Promise.all(airlines.map((airline) => {
    assertPeer(
      isObject(airline) &&
      typeof airline.id === 'string' &&
      typeof airline.name === 'string' &&
      (iataCodePattern.test(airline.id) || airline.id === '__'), // '__' is 'FakeAirline'
      'API sent invalid airlines response.'
    );

    // ignore '__', it is 'FakeAirline', stored in Kiwi API
    if (airline.id === '__') {
      return Promise.resolve();
    }

    return insertIfNotExistsAirline({
      name: `${airline.name} (${airline.id})`,
      code: airline.id,
      logoURL: `https://images.kiwi.com/airlines/64/${airline.id}.png`
    });
  }));

  // GET routes

  const subscriptionsPromises = subscriptions.map(async (sub) => {
    assertApp(
      isObject(sub) &&
      Number.isInteger(sub.id) &&
      Number.isInteger(sub.airport_from_id) &&
      Number.isInteger(sub.airport_to_id),
      'Invalid subscription data.'
    );

    let fetchId, airportFrom, airportTo;

    const newFetchResult = await insertDataFetch(sub.id);
    assertApp(
      isObject(newFetchResult) &&
      isObject(newFetchResult.stmt) &&
      Number.isInteger(newFetchResult.stmt.lastID),
      'Incorrect db response.'
    );

    fetchId = newFetchResult.stmt.lastID;
    const airports = await Promise.all([selectAirport(sub.airport_from_id), selectAirport(sub.airport_to_id)]);
    assertApp(
      Array.isArray(airports) &&
      airports.length === 2 &&
      airports.every((airport) => {
        return Array.isArray(airport) &&
          airport.length === 1 &&
          isObject(airport[0]) &&
          Number.isInteger(airport[0].id) &&
          typeof airport[0].iata_code === 'string' &&
          typeof airport[0].name === 'string';
      }),
      'Invalid airports data.'
    );

    airportFrom = airports[0][0];
    airportTo = airports[1][0];

    const response = await requestJSON('https://api.skypicker.com/flights', {
      flyFrom: airportFrom.iata_code,
      to: airportTo.iata_code,
      dateFrom: toKiwiAPIDateFormat(today()),
      dateTo: toKiwiAPIDateFormat(dateMonthsFromNow(3)),
      typeFlight: 'oneway',
      partner: 'picky',
      v: '2',
      xml: '0',
      locale: 'en',
      offset: '0',
      limit: '30' // TODO get not just 30 but the data for the next 3 months
    });

    assertPeer(
      isObject(response) &&
      Array.isArray(response.data) &&
      typeof response.currency === 'string',
      'API sent invalid data response.'
    );

    const routesPromises = response.data.map(async (data) => {
      assertPeer(
        isObject(data) &&
        typeof data.booking_token === 'string' &&
        Number.isInteger(data.price) &&
        Array.isArray(data.route),
        'API sent invalid route response.'
      );

      const routeId = await insertRoute({
        bookingToken: data.booking_token,
        price: data.price,
        fetchId: fetchId
      });

      const flightsPromises = data.route.map(async (flight) => {
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

        const flightId = await insertOrGetFlight({
          airlineCode: flight.airline,
          airportFromId: airportFrom.id,
          airportToId: airportTo.id,
          dtime: fromUnixTimestamp(flight.dTimeUTC),
          atime: fromUnixTimestamp(flight.aTimeUTC),
          flightNumber: flight.flight_no,
          remoteId: flight.id
        });

        return insertRouteFlight({
          flightId: flightId,
          routeId: routeId,
          isReturn: flight.return
        });
      });

      await Promise.all(flightsPromises);
      console.log(`Inserted ${flightsPromises.length} flights for route with id ${routeId} for subscription with id ${sub.id}.`);
    });

    await Promise.all(routesPromises);
    console.log(`Inserted ${routesPromises.length} routes for subscription with id ${sub.id}.`);
  });

  await Promise.all(subscriptionsPromises);
  console.log(`Checked ${subscriptionsPromises.length} subscriptions.`);
})();
