const SERVER_TIME_FORMAT = 'Y-MM-DDTHH:mm:ssZ';
const { assertPeer, assertApp, PeerError } = require('../modules/error-handling');
const { toSmallestCurrencyUnit, fromSmallestCurrencyUnit } = require('../modules/utils');
const { isObject } = require('lodash');
const moment = require('moment');

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

async function search (params, db) {
  assertPeer(
    isObject(params) &&
    typeof params.v === 'string' &&
    Number.isInteger(+params.fly_from) &&
    Number.isInteger(+params.fly_to) &&
    (!params.price_to || Number.isInteger(params.price_to)) &&
    (!params.currency || typeof params.currency === 'string') &&
    (!params.date_from || typeof params.date_from === 'string') &&
    (!params.date_to || typeof params.date_to === 'string') &&
    (!params.sort || typeof params.sort === 'string') &&
    (!params.max_fly_duration || Number.isInteger(params.max_fly_duration)),
    'Invalid search request.'
  );

  params.price_to = toSmallestCurrencyUnit(params.price_to);

  const result = {
    currency: params.currency
  };

  const subscriptions = await db.selectSubscriptions(+params.fly_from, +params.fly_to);

  if (subscriptions <= 0) {
    await subscribe({
      v: params.v,
      fly_from: params.fly_from,
      fly_to: params.fly_to
    }, db);

    result.status_code = 2000;
    result.routes = [];

    return result;
  }

  assertApp(
    subscriptions.length === 1 &&
    isObject(subscriptions[0]) &&
    Number.isInteger(subscriptions[0].fetchId) &&
    typeof subscriptions[0].timestamp === 'string',
    'Invalid subscription data.'
  );

  const fetchId = subscriptions[0].fetchId;
  const routesAndFlights = await db.selectRoutesFlights(fetchId, params);

  assertApp(
    Array.isArray(routesAndFlights),
    'Invalid database routes and flights response.'
  );

  const routesHash = {};

  for (const routeFlight of routesAndFlights) {
    assertApp(
      isObject(routeFlight) &&
      Number.isInteger(routeFlight.routeId) &&
      typeof routeFlight.bookingToken === 'string' &&
      Number.isInteger(routeFlight.price),
      'Invalid database route response.'
    );

    routesHash[routeFlight.routeId] = routesHash[routeFlight.routeId] || {
      booking_token: routeFlight.bookingToken,
      price: fromSmallestCurrencyUnit(routeFlight.price),
      route: []
    };

    assertApp(Array.isArray(routesHash[routeFlight.routeId].route));

    routesHash[routeFlight.routeId].route.push(routeFlight);
  }

  const routes = [];

  for (const routeId in routesHash) {
    assertApp(
      isObject(routesHash) &&
      isObject(routesHash[routeId]) &&
      Array.isArray(routesHash[routeId].route),
      'Invalid database route response'
    );

    assertApp(
      routesHash[routeId].route.every(flight => {
        return Number.isInteger(flight.afromId) &&
          Number.isInteger(flight.atoId) &&
          typeof flight.airlineName === 'string' &&
          typeof flight.logoURL === 'string' &&
          typeof flight.afromName === 'string' &&
          typeof flight.atoName === 'string' &&
          typeof flight.dtime === 'string' &&
          typeof flight.atime === 'string' &&
          typeof flight.flightNumber === 'string' &&
          (flight.isReturn === 1 || flight.isReturn === 0);
      }),
      'Invalid database flight response.'
    );

    if (
      routesHash.hasOwnProperty(routeId) &&
      routesHash[routeId].route.some((flight) => flight.afromId === +params.fly_from) &&
      routesHash[routeId].route.some((flight) => flight.atoId === +params.fly_to)
    ) {
      routes.push({
        ...routesHash[routeId],
        route: routesHash[routeId].route.map((flight) => dbToAPIRouteFlight(flight))
      });
    }
  }

  const flyDurationCalculator = (acc, flight) => {
    const arrivalTime = moment(flight.atime, SERVER_TIME_FORMAT);
    const departureTime = moment(flight.dtime, SERVER_TIME_FORMAT);

    return acc + arrivalTime.diff(departureTime, 'hours');
  };

  const flyDurationIncluder = (route) => {
    const accInitValue = 0;
    const flyDuration = route.route.reduce(flyDurationCalculator, accInitValue);

    return { route, flyDuration };
  };

  const flyDurationFilter = (route) => !params.max_fly_duration || route.flyDuration <= params.max_fly_duration;
  const flyDurationExcluder = (route) => {
    return { ...route.route };
  };

  const comparePrices = function comparePrices (route1, route2) {
    if (route1.price > route2.price) {
      return 1;
    } else if (route1.price < route2.price) {
      return -1;
    }
    return 0;
  };

  const compareDepartureTimes = function compareDepartureTimes (flight1, flight2) {
    const departureTime1 = moment(flight1.dtime, SERVER_TIME_FORMAT);
    const departureTime2 = moment(flight2.dtime, SERVER_TIME_FORMAT);

    if (departureTime1.isAfter(departureTime2)) {
      return 1;
    } else if (departureTime2.isAfter(departureTime1)) {
      return -1;
    }
    return 0;
  };

  const flightsInRouteSorter = function flightsInRouteSorter (route) {
    // sorts flights in a route by departure time
    return {
      ...route,
      route: route.route.sort(compareDepartureTimes)
    };
  };

  const routesFiltered = routes
    .map(flyDurationIncluder)
    .filter(flyDurationFilter)
    .map(flyDurationExcluder)
    .sort(comparePrices)
    .map(flightsInRouteSorter);

  result.routes = routesFiltered;
  result.status_code = 1000;

  return result;
}

async function subscribe (params, db) {
  assertPeer(
    isObject(params) &&
    Number.isInteger(+params.v) &&
    Number.isInteger(+params.fly_from) &&
    Number.isInteger(+params.fly_to),
    'Invalid subscribe request.'
  );

  const isInserted = await db.insertIfNotExistsSubscription(+params.fly_from, +params.fly_to);

  return {
    status_code: (isInserted) ? 1000 : 2000
  };
}

async function unsubscribe (params, db) {
  assertPeer(
    isObject(params) &&
    Number.isInteger(+params.v) &&
    Number.isInteger(+params.fly_from) &&
    Number.isInteger(+params.fly_to),
    'Invalid unsubscribe request.'
  );

  const isDeleted = await db.deleteIfNotExistsSubscription(+params.fly_from, +params.fly_to);

  return {
    status_code: (isDeleted) ? 1000 : 2000
  };
}

module.exports = function resolveMethod (body) {
  assertPeer(
    isObject(body) &&
    typeof body.method === 'string',
    'Invalid input format. Method not found.'
  );

  if (body.method === 'search') {
    return {
      name: 'search',
      execute: search
    };
  } else if (body.method === 'subscribe') {
    return {
      name: 'subscribe',
      execute: subscribe
    };
  } else if (body.method === 'unsubscribe') {
    return {
      name: 'unsubscribe',
      execute: unsubscribe
    };
  } else {
    throw new PeerError(`Unknown method "${body.method}"`);
  }
};
