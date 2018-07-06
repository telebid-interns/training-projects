'use strict';
/* global $, _ */
const MAX_ROUTES_PER_PAGE = 5;
const SERVER_URL = 'http://10.20.1.155:3000';
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];
let jsonRPCRequestId = 1;
let $errorBar;
const errorMessagesQueue = [];

(function setupErrorMessages () {
  setInterval(() => {
    if (!$errorBar) {
      return;
    }

    if (errorMessagesQueue.length !== 0) {
      $errorBar.text(errorMessagesQueue.shift());
    } else {
      $errorBar.text('');
    }
  },
  5000);
})();

function displayErrorMessage (errMsg) {
  errorMessagesQueue.push(errMsg);
}

class BaseError extends Error {
  constructor ({userMessage, logs}) {
    super(userMessage);

    this.userMessage = userMessage;
    this.logs = logs;

    if (this.logs) {
      console.error(...this.logs);
    }
  }

  static assert (condition, errorParams) {
    if (!condition) {
      throw new BaseError(errorParams);
    }
  }
}

class ApplicationError extends BaseError {
  constructor ({userMessage, logs}) {
    if (!userMessage) {
      userMessage = 'Application encountered an unexpected condition. Please refresh the page.';
    }
    super({userMessage, logs});

    window.alert(userMessage);
  }

  static assert (condition, errorParams) {
    if (!condition) {
      throw new ApplicationError(errorParams);
    }
  }
}

class PeerError extends BaseError {
  constructor ({userMessage, logs}) {
    if (!userMessage) {
      userMessage = 'Service is not available at the moment. Please refresh the page and try' +
                    ' later.';
    }
    super({userMessage, logs});
  }

  static assert (condition, errorParams) {
    if (!condition) {
      throw new PeerError(errorParams);
    }
  }
}

const AIRPORT_HASH = airportDump();

function getAirportByString (term) {
  term = term.toLowerCase();

  for (let airport of Object.values(AIRPORT_HASH)) {
    let strings = [
      airport.iataID.toLowerCase(),
      airport.latinName.toLowerCase(),
      airport.nationalName.toLowerCase(),
      airport.cityName.toLowerCase()
    ];

    if (_.includes(strings, term)) {
      return airport;
    }
  }
}

/**
 * Make a search method call to the server and retrieve possible routes
 * All parameters must be JS primitives with their corresponding type in
 * the API docs.
 *
 **/
async function search ({
  flyFrom,
  flyTo,
  priceTo,
  currency,
  dateFrom,
  dateTo,
  sort,
  maxFlyDuration
}) {
  const required = ['fly_from', 'fly_to'];
  const fixed = {sort: ['price', 'duration'], currency: ['USD', 'BGN']};
  const params = validateParams(
    {
      v: '1.0', // this is better to be passed through the url for better optimization
      fly_from: flyFrom.id,
      fly_to: flyTo.id,
      price_to: priceTo,
      currency: currency,
      date_from: dateFrom,
      date_to: dateTo,
      sort: sort,
      max_fly_duration: maxFlyDuration
    },
    required,
    fixed
  );

  console.log('Searching', params);

  let jsonRPCResponse = await jsonRPCRequest('search', params);
  let response = switchStyle(jsonRPCResponse, snakeToCamel);

  for (let routeObj of response.routes) {
    // server doesn't provide currency yet
    if (response.currency) {
      routeObj.price += ' ' + response.currency;
    } else {
      routeObj.price += ' $';
    }

    for (let flight of routeObj.route) {
      flight.dtime = new Date(flight.dtime);
      flight.atime = new Date(flight.atime);

      // server doesn't provide city_from and city_to yet
      flight.cityFrom = flight.cityFrom || '';
      flight.cityTo = flight.cityTo || '';
    }

    routeObj.route = sortRoute(routeObj.route);
    routeObj.dtime = routeObj.route[0].dtime;
    routeObj.atime = routeObj.route[routeObj.route.length - 1].atime;
  }

  response.routes = _.sortBy(response.routes, [routeObj => routeObj.dtime]);

  return response;
}

async function subscribe (fromAiport, toAirport) {
  console.log('Subscribing', fromAiport, toAirport);

  let response;
  let params = {
    v: '1.0',
    fly_from: fromAiport.id,
    fly_to: toAirport.id
  };

  try {
    response = await jsonRPCRequest('subscribe', params);
  } catch (e) {
    e.userMessage = `Failed to subscribe for flights from airport ${fromAiport.nationalName} to airport ${toAirport.nationalName}.`;
    throw e;
  }

  PeerError.assert(response.status_code >= 1000 && response.status_code < 2000,
    {
      userMessage: `Already subscribed for flights from ${fromAiport.latinName} to ${toAirport.latinName}.`,
      logs: [
        'Tried to subscribe but subscription already existed.',
        'Sent params: ',
        params,
        'Got response: ',
        response]
    });
}

async function unsubscribe (fromAirport, toAirport) {
  console.log('Unsubscribing', fromAirport, toAirport);

  let response;
  let params = {
    v: '1.0',
    fly_from: fromAirport.id,
    fly_to: toAirport.id
  };

  try {
    response = await jsonRPCRequest('unsubscribe', params);
  } catch (e) {
    e.userMessage = `Failed to unsubscribe for flights from airport ${fromAiport.nationalName} to airport ${toAirport.nationalName}.`;
    throw e;
  }

  PeerError.assert(response.status_code >= 1000 && response.status_code < 2000,
    {
      userMessage: `You aren't subscribed for flights from airport ${fromAiport.nationalName} to airport ${toAirport.nationalName}.`,
      logs: [
        'Server returned unknown status code',
        'Sent params: ',
        params,
        'Got response: ',
        response]
    });

  return params;
}

async function jsonRPCRequest (method, params) {
  let request = {
    jsonrpc: '2.0',
    method,
    params: params,
    id: jsonRPCRequestId
  };
  let response;

  try {
    response = await postJSON(SERVER_URL, request);
  } catch (error) {
    throw new PeerError({
      logs: [
        'failed to make a post request to server API', 'url: ', SERVER_URL,
        'request data: ', request, 'error raised: ', error
      ]
    });
  }

  // increment id only on successful requests
  jsonRPCRequestId++;

  let logs = ['jsonrpc protocol error', 'sent data: ', request, 'got response', response];
  let errorReport = {logs: logs};

  PeerError.assert(['jsonrpc', 'id'].every(prop => _.has(response, prop)), errorReport);
  PeerError.assert(!response.error, errorReport);
  PeerError.assert(response.result, errorReport);
  ApplicationError.assert(response.id !== null,
    {
      logs: [
        'Server sent back a null id for request: ', request,
        'Full response is: ', response]
    }
  );

  if (response.id !== request.id) {
    console.warn('Different id between response and request.');
    console.warn(
      'Ignoring because server always returns id = 1 at the moment.');
    // throw new ApplicationError(
    //     'An unexpected behaviour occurred. Please refresh the page.',
    //     'json rpc response and request id are out of sync',
    //     'request id =', request.id,
    //     'response id =', response.id,
    // );
  }

  return response.result;
}

async function postJSON (url, data) {
  let serverResponse;

  try {
    serverResponse = await window.fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  } catch (e) {
    throw new PeerError({
      userMessage: 'Service is not available at the moment due to network issues',
      logs: ['Couldn\'t connect to server at url: ', url, 'Sent POST request with data: ', data]
    });
  }

  PeerError.assert(serverResponse.ok, {
    logs: ['Sent POST request with data: ', data, 'Got NOT OK response back', serverResponse]
  });

  return serverResponse.json();
}

function sortRoute (route) {
  function comparison (a, b) {
    return a.dtime - b.dtime;
  }

  let result = route.slice(0);

  result.sort(comparison);

  return result;
}

function timeStringFromDate (date) {
  const hours = date.getUTCHours()
    .toString()
    .padStart(2, '0');
  const minutes = date.getUTCMinutes()
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}`;
}

function weeklyDateString (date) {
  let monthName = MONTH_NAMES[date.getMonth()];
  let dayName = WEEK_DAYS[date.getDay()];

  return `${dayName} ${date.getDate()} ${monthName}`;
}

function cleanUndefinedFromObject (obj) {
  return Object.entries(obj)
    .reduce((newObj, entry) => {
      let [key, value] = entry;

      if (obj[key] !== undefined) {
        newObj[key] = value;
      }

      return newObj;
    },
    {}
    );
}

function setupLoading ($button, $routesList) {
  const step = 5;

  $button.click(() => {
    let loaded = $routesList.children()
      .filter(':visible').length;
    $routesList.children()
      .slice(loaded, loaded + step + 1)
      .show();

    if (loaded + step >= $routesList.children().length) {
      $button.hide();
    }
  });
}

function displaySearchResult (searchResult, $routesList, $routeItemTemplate, $flightItemTemplate) {
  console.log('Displaying search result', searchResult);
  $routesList.find('li:not(:first)')
    .remove();

  if (
    searchResult === undefined ||
    (Object.keys(searchResult).length === 0 && searchResult.constructor === Object)
  ) {
    return;
  }

  for (let [index, route] of searchResult.routes.entries()) {
    let $clone = $routeItemTemplate.clone();
    let $routeList = $clone.find('ul');
    let $newRoute = fillListFromRoute($routeList, route.route, $flightItemTemplate);

    if (index < MAX_ROUTES_PER_PAGE) {
      $clone.show();
    }

    $clone.find('.route-price')
      .text(route.price);
    $routesList.append($clone.append($newRoute));

    let $timeElements = $clone.find('time');

    $($timeElements[0])
      .attr('datetime', route.dtime)
      .text(weeklyDateString(route.dtime) + ' ' + timeStringFromDate(route.dtime)
      );
    $($timeElements[1])
      .attr('datetime', route.dtime)
      .text(weeklyDateString(route.atime) + ' ' + timeStringFromDate(route.atime)
      );
  }

  $('#load-more-button')
    .show();
}

function fillListFromRoute ($listTemplate, route, $flightItemTemplate) {
  $listTemplate.find('li:not(:first)')
    .remove();

  for (let flight of route) {
    $listTemplate.append(makeFlightItem(flight, $flightItemTemplate));
  }

  $listTemplate.show();

  return $listTemplate;
}

function makeFlightItem (flight, $itemTemplate) {
  let $clone = $itemTemplate.clone()
    .removeAttr('id')
    .removeClass('hidden');

  let duration = flight.atime.getTime() - flight.dtime.getTime();

  duration = (duration / 1000 / 60 / 60).toFixed(2);
  duration = (duration + ' hours').replace(':');

  $clone.find('.airline-logo')
    .attr('src', flight.airlineLogo);
  $clone.find('.airline-name')
    .text(flight.airlineName);
  $clone.find('.departure-time')
    .text(timeStringFromDate(flight.dtime));
  $clone.find('.arrival-time')
    .text(timeStringFromDate(flight.atime));
  $clone.find('.flight-date')
    .text(weeklyDateString(flight.dtime));
  $clone.find('.timezone')
    .text('UTC');
  $clone.find('.duration')
    .text(duration);
  // TODO later change to city when server implements the field
  $clone.find('.from-to-display')
    .text(`${flight.airportFrom} -----> ${flight.airportTo}`);

  return $clone;
}

function watchInputField ($inputField, callback) {
  let lastValue = '';

  function callbackOnChange (event) {
    let newVal = $inputField.serialize();
    if (newVal !== lastValue) {
      lastValue = newVal;
      callback(event);
    }
  }

  $inputField.on('keyup', callbackOnChange);
}

function setupAutoComplete ({hash, $textInput, $dataList}) {
  let keys = Object.keys(hash)
    .sort();

  watchInputField($textInput, () => {
    let minCharacters = 1;
    let maxSuggestions = 100;

    if ($textInput.val().length < minCharacters) {
      return;
    }

    $dataList.empty();

    let suggestionsCount = 0;

    for (let key of keys) {
      if (suggestionsCount === maxSuggestions) {
        break;
      }

      if (key.indexOf($textInput.val()) !== -1) {
        suggestionsCount += 1;

        let newOption = `<option value="${key}">`;

        $dataList.append(newOption);
        console.log('appended option', newOption);
      }
    }
  });
}

function searchFormParams ($searchForm) {
  let formData = objectifyForm($searchForm.serializeArray());
  let flyFrom = getAirportByString(formData.from);
  let flyTo = getAirportByString(formData.to);

  console.log('Form data: ', formData);

  PeerError.assert(flyFrom,
    {
      userMessage: `${formData.from} is not a location that has an airport!`,
      logs: ['User entered an invalid string in #arrival-input - ', formData.to]
    }
  );
  PeerError.assert(flyTo,
    {userMessage: `${formData.to} is not a location that has an airport!`}
  );

  let dateFrom = dateFromFields({
    monthField: formData['departure-month'],
    dayField: formData['departure-day']
  });
  dateFrom.setUTCHours(0, 1, 1);

  // TODO refactor
  let dateTo;

  if (formData['arrival-month'] || formData['arrival-day']) {
    dateTo = dateFromFields({
      monthField: formData['arrival-month'],
      dayField: formData['arrival-day']
    });
    dateTo.setUTCHours(23, 59, 59);
  }

  return cleanUndefinedFromObject({
    flyFrom: flyFrom,
    flyTo: flyTo,
    dateFrom: dateFrom,
    dateTo: dateTo
  });
}

function objectifyForm (formArray) {
  return formArray.reduce(
    (obj, entry) => {
      if (entry.value !== undefined && entry.value !== '') {
        obj[entry.name] = entry.value;
      }
      return obj;
    },
    {});
}

function dateFromFields ({yearField, monthField, dayField}) {
  let date = new Date();

  // TODO problematic when not all of the fields are set
  if (yearField) {
    date.setFullYear(yearField);
  }
  if (monthField) {
    date.setMonth(monthField);
  }
  if (dayField) {
    date.setDate(dayField);
  }

  return date;
}

$(document)
  .ready(() => {
    $errorBar = $('#errorBar');

    let $allRoutesList = $('#all-routes-list');
    let $flightsListTemplate = $('#flights-list-item-template');
    let $flightItemTemplate = $('#flight-item-template');

    let $flightForm = $('#flight-form-input');
    let flightFormData = '';

    $flightForm.on('submit',
      async event => {
        event.preventDefault();

        if ($flightForm.serialize() === flightFormData) {
          return false;
        }

        flightFormData = $flightForm.serialize();

        let formParams;

        try {
          formParams = searchFormParams($flightForm);
        } catch (e) {
          handleError(e);
          return false;
        }

        try {
          let response = await search(formParams);

          if (response.statusCode >= 1000 && response.statusCode < 2000) {
            displaySearchResult(response, $allRoutesList,
              $flightsListTemplate, $flightItemTemplate);
          } else if (response.statusCode === 2000) {
            displayErrorMessage('There is no information about this flight at the moment. Please' +
                                ' come back in 15 minutes.');
          }
        } catch (e) {
          handleError(e);
        }

        return false;
      });

    let byNames = Object.values(AIRPORT_HASH)
      .reduce(
        (hash, airport) => {
          hash[airport.latinName] = airport;
          hash[airport.nationalName] = airport;
          hash[airport.cityName] = airport;
          return hash;
        },
        {}
      );

    setupAutoComplete({
      hash: byNames,
      $textInput: $('#from-input'),
      $dataList: $('#from-airports')
    });
    setupAutoComplete({
      hash: byNames,
      $textInput: $('#to-input'),
      $dataList: $('#to-airports')
    });

    setupLoading($('#load-more-button'), $allRoutesList);
  });

window.addEventListener('error', (error) => {
  handleError(error);

  // suppress
  return true;
});

function handleError (error) {
  console.error(error);

  if (error.userMessage) {
    console.log('displaying user message');
    displayErrorMessage(error.userMessage);
  }
}

function validateParams (params, required, fixed) {
  // TODO this might not be needed if the API can accept undefined values
  params = cleanUndefinedFromObject(params);

  for (let requiredParam of required) {
    ApplicationError.assert(
      !_.has(required, requiredParam),
      {logs: ['Missing required keyword argument: ', requiredParam]}
    );
  }

  for (let [fixedParam, possibleStates] of Object.entries(fixed)) {
    ApplicationError.assert(
      !_.has(params, fixedParam) && !_.includes(possibleStates, params[fixedParam]),
      {
        logs: [
          'Paramater', fixedParam,
          'is not one of:', fixed[fixedParam],
          'instead got -', params[fixedParam]]
      }
    );
  }

  return params;
}

function switchStyle (json, converter) {
  function switchHash (hash) {
    return _.mapKeys(hash, (value, key) => converter(key));
  }

  function switcher (json) {
    let converted = switchHash(json);

    for (let [key, value] of Object.entries(converted)) {
      if (_.isPlainObject(value)) {
        value = switcher(value);
      } else if (Array.isArray(value)) {
        value = value.map(switcher);
      }

      converted[key] = value;
    }

    return converted;
  }

  return switcher(json);
}

function snakeToCamel (string) {
  let words = string.split('_');
  let top = words[0];

  words.splice(0, 1);

  return top + words.map(_.capitalize)
    .join('');
}
