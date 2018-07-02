module.exports = (() => {
  const path = require('path');
  const sqlite = require('sqlite');
  const { assertApp } = require('./error-handling');
  const isObject = require('./is-object');
  let db;

  async function dbConnect () {
    db = await sqlite.open(path.join(__dirname, '../freefall.db'));
  }

  function assertDB () {
    assertApp(
      isObject(db) &&
      isObject(db.driver) &&
      db.driver.open,
      'No database connection.'
    );
  }

  function stringifyColumns (columns) {
    assertApp(
      columns instanceof Array &&
      columns.length > 0,
      'Invalid argument columns.'
    );

    return columns.join(', ');
  }

  async function select (table, columns) {
    assertDB();
    assertApp(
      typeof table === 'string',
      'Expected string for a name of table'
    );

    return db.all(`SELECT ${stringifyColumns(columns)} FROM ${table};`);
  }

  async function selectWhereColEquals (table, columns, whereCol, value) {
    assertDB();
    assertApp(
      typeof table === 'string' &&
      Array.isArray(columns) &&
      typeof whereCol === 'string',
      'Invalid select data'
    );

    return db.all(`SELECT ${stringifyColumns(columns)} FROM ${table} WHERE ${whereCol} = ?;`, [value]);
  }

  async function selectAirport (airportId) {
    assertDB();
    assertApp(
      Number.isInteger(airportId),
      'Invalid airport id'
    );

    return selectWhereColEquals('airports', ['id', 'iata_code', 'name'], 'id', airportId);
  }

  async function selectFlight (remoteId) {
    assertDB();
    assertApp(
      typeof remoteId === 'string',
      'Invalid flight id'
    );

    return selectWhereColEquals('flights', ['id'], 'remote_id', remoteId);
  }

  async function selectAirline (airlineCode) {
    assertDB();
    assertApp(
      typeof airlineCode === 'string',
      'Invalid airline code.'
    );

    return selectWhereColEquals('airlines', ['id'], 'code', airlineCode);
  }

  async function insert (table, columns, row) {
    assertDB();
    assertApp(
      typeof table === 'string' &&
      Array.isArray(columns) &&
      columns.length > 0 &&
      columns.every((col) => typeof col === 'string') &&
      Array.isArray(row) && row.length === columns.length,
      'Invalid insert data.'
    );

    const columnsStringified = columns.join(', ');
    const rowStringified = Array(columns.length).fill('?').join(', ');
    return db.run(`INSERT INTO ${table} (${columnsStringified}) VALUES (${rowStringified});`, row);
  }

  async function insertDataFetch (subscriptionId) {
    assertDB();

    return db.run('INSERT INTO fetches(timestamp, subscription_id) VALUES (strftime(\'%Y-%m-%dT%H:%M:%SZ\' ,\'now\'), ?);', [subscriptionId]);
  }

  async function insertRoute (route) {
    assertDB();

    const routeResult = await db.run('INSERT INTO routes(booking_token, price, fetch_id) VALUES (?, ?, ?);', [route.bookingToken, route.price, route.fetchId]);

    assertApp(
      isObject(routeResult) &&
      isObject(routeResult.stmt) &&
      Number.isInteger(routeResult.stmt.lastID),
      'Incorrect db response.'
    );

    return routeResult.stmt.lastID;
  }

  async function insertIfNotExistsAirline (airline) {
    assertDB();

    const airlineIdResult = await selectAirline(airline.code);

    assertApp(Array.isArray(airlineIdResult), 'Invalid db response.');

    if (airlineIdResult.length > 0) {
      assertApp(airlineIdResult.length === 1, 'Invalid db response.');

      console.log(`Airline with code ${airline.code} already exists`);

      return airlineIdResult[0].id;
    }

    await db.run(`

      INSERT INTO airlines
        (name, code, logo_url)
      VALUES
        (?, ?, ?);

    `,
    [airline.name, airline.code, airline.logoURL]
    );

    console.log(`Inserted airline with code ${airline.code}`);
  }

  async function insertOrGetFlight (flight) {
    assertDB();

    const flightIdResult = await selectFlight(flight.remoteId);

    assertApp(Array.isArray(flightIdResult), 'Invalid db response.');

    if (flightIdResult.length > 0) {
      assertApp(flightIdResult.length === 1, 'Invalid db response.');

      return flightIdResult[0].id;
    }

    const flightResult = await db.run(`

      INSERT OR IGNORE INTO flights
        (airline_id, airport_from_id, airport_to_id, dtime, atime, flight_number, remote_id)
      VALUES
        ((SELECT id FROM airlines WHERE code = ?), ?, ?, ?, ?, ?, ?);

      `,
    [flight.airlineCode, flight.airportFromId, flight.airportToId, flight.dtime, flight.atime, flight.flightNumber, flight.remoteId]
    );

    assertApp(
      isObject(flightResult) &&
      isObject(flightResult.stmt) &&
      Number.isInteger(flightResult.stmt.lastID),
      'Incorrect db response.'
    );

    return flightResult.stmt.lastID;
  }

  async function insertRouteFlight (routeFlight) {
    assertDB();

    return db.run('INSERT OR IGNORE INTO routes_flights(flight_id, route_id, is_return) VALUES (?, ?, ?);', [routeFlight.flightId, routeFlight.routeId, routeFlight.isReturn]);
  }

  return {
    select,
    insert,
    insertDataFetch,
    insertRoute,
    insertOrGetFlight,
    insertRouteFlight,
    insertIfNotExistsAirline,
    selectAirport,
    dbConnect
  };
})();
