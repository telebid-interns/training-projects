const { assertUser, assertApp } = require('../modules/error-handling.js');
const isObject = require('../modules/is-object.js');

function dbToAPIRouteFlight (routeFlight) {
  assertApp(
    typeof routeFlight.airlineName === 'string' &&
    typeof routeFlight.logoURL === 'string' &&
    typeof routeFlight.afromName === 'string' &&
    typeof routeFlight.atoName === 'string' &&
    typeof routeFlight.dtime === 'string' &&
    typeof routeFlight.atime === 'string' &&
    typeof routeFlight.flightNumber === 'string' &&
    (routeFlight.isReturn === 1 || routeFlight.isReturn === 0),
    'Invalid database flight response.'
  );

  return {
    airport_from: routeFlight.afromName,
    airport_to: routeFlight.atoName,
    return: !!routeFlight.isReturn,
    dtime: routeFlight.dtime,
    atime: routeFlight.atime,
    airline_logo: routeFlight.logoURL,
    airline_name: routeFlight.airlineName,
    flight_number: routeFlight.flightNumber
  };
}

module.exports = async function search (params, db) {
  assertUser(
    isObject(params) &&
    typeof params.v === 'string' &&
    Number.isInteger(Number(params.fly_from)) &&
    Number.isInteger(Number(params.fly_to)) &&
    Number.isInteger(params.price_to) &&
    typeof params.currency === 'string' &&
    typeof params.date_from === 'string' &&
    typeof params.date_to === 'string' &&
    typeof params.sort === 'string' &&
    Number.isInteger(params.max_fly_duration),
    'Invalid search request.'
  );

  const result = {};
  result.currency = params.currency;
  const { fetchId } = await db.selectSubscription(Number(params.fly_from), Number(params.fly_to));
  console.log(fetchId);
  const routesAndFlights = await db.selectRoutesFlights(fetchId);

  assertApp(
    Array.isArray(routesAndFlights),
    'Invalid database routes and flights response.'
  );

  const routes = {};

  for (const routeFlight of routesAndFlights) {
    assertApp(
      isObject(routeFlight) &&
      Number.isInteger(routeFlight.routeId) &&
      typeof routeFlight.bookingToken === 'string' &&
      Number.isInteger(routeFlight.price),
      'Invalid database route response.'
    );

    if (routeFlight.routeId in routes) {
      routes[routeFlight.routeId].route.push(dbToAPIRouteFlight(routeFlight));
    } else {
      routes[routeFlight.routeId] = {
        booking_token: routeFlight.bookingToken,
        price: routeFlight.price,
        route: [dbToAPIRouteFlight(routeFlight)]
      };
    }
  }

  console.log(routes);
};
