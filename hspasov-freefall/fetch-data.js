function handleError (err) {
  console.error('Error while fetching data:');
  console.error(err);
  process.exit();
}

process.on('error', (err) => {
  handleError(err);
});

process.on('unhandledRejection', (err) => {
  handleError(err);
});

(async () => {
  const ROUTES_LIMIT = 30;
  const { fromUnixTimestamp, toKiwiAPIDateFormat, today, dateMonthsFromNow } = require('./modules/date-format');
  const { dbConnect, select, insertDataFetch, insertRoute, insertOrGetFlight, insertRouteFlight, selectAirport, insertIfNotExistsAirline, selectWhereColEquals, insert } = require('./modules/db');
  const { requestJSON } = require('./modules/request');
  const { assertApp, assertPeer } = require('./modules/error-handling');
  const isObject = require('./modules/is-object');

  await dbConnect();
  const subscriptions = await select('subscriptions', ['id', 'airport_from_id', 'airport_to_id']);

  assertApp(Array.isArray(subscriptions), 'Invalid select subscriptions response.');

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

  for (const sub of subscriptions) {
    assertApp(
      isObject(sub) &&
      Number.isInteger(sub.id) &&
      Number.isInteger(sub.airport_from_id) &&
      Number.isInteger(sub.airport_to_id),
      'Invalid subscription data.'
    );

    const newFetchResult = await insertDataFetch(sub.id);

    assertApp(
      isObject(newFetchResult) &&
      isObject(newFetchResult.stmt) &&
      Number.isInteger(newFetchResult.stmt.lastID),
      'Incorrect db response.'
    );

    const fetchId = newFetchResult.stmt.lastID;
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

    const airportFrom = airports[0][0];
    const airportTo = airports[1][0];

    await getAirportsAndFlights(airportFrom.iata_code, airportTo.iata_code, fetchId, 0);
  }

  console.log(`Checked ${subscriptions.length} subscriptions.`);

  async function getAirportsAndFlights (airportFrom, airportTo, fetchId, offset) {
    assertApp(
      typeof airportFrom === 'string' &&
      typeof airportTo === 'string',
      'Invalid airport data.'
    );

    const flightsHash = {};
    const airportsSet = [];

    const response = await requestJSON('https://api.skypicker.com/flights', {
      flyFrom: airportFrom,
      to: airportTo,
      dateFrom: toKiwiAPIDateFormat(today()),
      dateTo: toKiwiAPIDateFormat(dateMonthsFromNow(1)),
      typeFlight: 'oneway',
      partner: 'picky',
      v: '2',
      xml: '0',
      locale: 'en',
      offset: offset,
      limit: ROUTES_LIMIT
    });

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

      for (const flight of data.route) {
        assertPeer(
          isObject(flight) &&
          Number.isInteger(flight.flight_no) &&
          Number.isInteger(flight.aTimeUTC) &&
          Number.isInteger(flight.dTimeUTC) &&
          (flight.return === 0 || flight.return === 1) &&
          typeof flight.flyFrom === 'string' &&
          typeof flight.flyTo === 'string' &&
          flight.flyFrom !== flight.flyTo &&
          typeof flight.airline === 'string' &&
          typeof flight.id === 'string',
          'API sent invalid flight response.'
        );

        flightsHash[flight.id] = flightsHash[flight.id] || flight;
        if (!airportsSet.includes(flight.flyFrom)) {
          airportsSet.push(flight.flyFrom);
        }
        if (!airportsSet.includes(flight.flyTo)) {
          airportsSet.push(flight.flyTo);
        }
      }
    }

    await Promise.all(airportsSet.map((IATACode) => insertAirportInDBIfNotExists(IATACode)));

    await Promise.all(Object.values(flightsHash).map(async (flight) => {
      const airportCodes = [flight.flyFrom, flight.flyTo];
      const airportIds = await Promise.all(airportCodes.map((IATACode) => insertAirportInDBIfNotExists(IATACode)));

      return insertOrGetFlight({
        airlineCode: flight.airline,
        airportFromId: airportIds[0],
        airportToId: airportIds[1],
        dtime: fromUnixTimestamp(flight.dTimeUTC),
        atime: fromUnixTimestamp(flight.aTimeUTC),
        flightNumber: flight.flight_no,
        remoteId: flight.id
      });
    }));

    const routesPromises = response.data.map(async (data) => {
      const routeId = await insertRoute({
        bookingToken: data.booking_token,
        price: data.price,
        fetchId: fetchId
      });

      const flightsPromises = data.route.map(async (flight) => {
        const airportCodes = [flight.flyFrom, flight.flyTo];
        const airportIds = await Promise.all(airportCodes.map((IATACode) => insertAirportInDBIfNotExists(IATACode)));

        const flightId = await insertOrGetFlight({
          airlineCode: flight.airline,
          airportFromId: airportIds[0],
          airportToId: airportIds[1],
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
      // console.log(`Inserted ${flightsPromises.length} flights for route with id ${routeId} for subscription with id ${sub.id}.`);
    });

    await Promise.all(routesPromises);
    // console.log(`Inserted ${routesPromises.length} routes for subscription with id ${sub.id}.`);

    if (typeof response._next === 'string') {
      getAirportsAndFlights(airportFrom, airportTo, fetchId, offset + ROUTES_LIMIT);
    }
  }

  async function insertAirportInDBIfNotExists (IATACode) {
    const airports = await selectWhereColEquals('airports', ['id'], 'iata_code', IATACode);

    assertApp(
      Array.isArray(airports),
      'Invalid database airport response.'
    );

    if (airports.length > 0) {
      assertApp(
        airports.length === 1 &&
        Number.isInteger(airports[0].id),
        'Invalid database airport response.'
      );

      return airports[0].id;
    } else {
      const response = await requestJSON('https://api.skypicker.com/locations', {
        term: IATACode,
        locale: 'en-US',
        location_types: 'airport',
        limit: '1'
      });

      assertPeer(
        isObject(response) &&
        Array.isArray(response.locations) &&
        response.locations.length === 1 &&
        isObject(response.locations[0]) &&
        typeof response.locations[0].code === 'string' &&
        typeof response.locations[0].name === 'string' &&
        'API sent invalid airport data response.'
      );

      const insertResult = await insert(
        'airports',
        ['iata_code', 'name'],
        [response.locations[0].code, `${response.locations[0].name} ${response.locations[0].code}`]
      );

      assertApp(
        isObject(insertResult) &&
        isObject(insertResult.stmt) &&
        Number.isInteger(insertResult.stmt.lastID),
        'Incorrect db response.'
      );

      return insertResult.stmt.lastID;
    }
  }
})();
