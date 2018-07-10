'use strict';

function start () {
  const MAX_ROUTES_PER_PAGE = 5;
  const SERVER_URL = 'http://10.20.1.155:3000';
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEK_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  let jsonRPCRequestId = 1; // closures
  let $errorBar; // closures
  const errorMessagesQueue = [];
  const validateSearchReq = getValidateSearchReq();
  const validateSearchRes = getValidateSearchRes();
  const validateSubscriptionReq = getValidateSubscriptionReq();
  const validateSubscriptionRes = getValidateSubscriptionRes();
  const traceLog = [];

  function trace (msg) {
    traceLog.push(msg);
  }

  function objToString (obj) {
    return Object.entries(obj).map(pair => pair.join(':')).join(',');
  }

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
        // TODO log error
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
  }

  class PeerError extends BaseError {
    constructor ({userMessage, logs}) {
      if (!userMessage) {
        userMessage = 'Service is not available at the moment. Please refresh the page and try' +
                      ' later.';
      }
      super({userMessage, logs});
    }
  }

  class UserError extends BaseError {
    constructor ({userMessage, logs}) {
      super({userMessage, logs});
    }
  }

  function assertApp (condition, errorParams) {
    if (!condition) {
      throw new ApplicationError(errorParams);
    }
  }

  function assertPeer (condition, errorParams) {
    if (!condition) {
      throw new PeerError(errorParams);
    }
  }

  function assertUser (condition, errorParams) {
    if (!condition) {
      throw new UserError(errorParams);
    }
  }

  const AIRPORT_HASH = airportDump();

  function getAirport (term) {
    trace(`getAirport(${term}), typeof arg=${typeof term}`);

    term = term.toLowerCase();

    for (const airport of Object.values(AIRPORT_HASH)) {
      const strings = [
        airport.id,
        airport.iataID.toLowerCase(),
        airport.latinName.toLowerCase(),
        airport.nationalName.toLowerCase(),
        airport.cityName.toLowerCase(),
      ];

      if (_.includes(strings, term)) {
        trace(`getAirport(${term}) returning ${strings.join(',')}`);
        return airport;
      }
    }
    trace(`getAirport(${term}) returning undefined`);
  }

  /**
   * Make a search method call to the server and retrieve possible routes
   * All parameters must be JS primitives with their corresponding type in
   * the API docs.
   *
   **/
  async function search (params) {
    trace(`search(${objToString(params)}), typeof arg=${typeof params}`);

    assertApp(validateSearchReq(params), 'Params do not adhere to searchRequestSchema.');

    const response = await jsonRPCRequest('search', params);

    assertPeer(validateSearchRes(response), 'Params do not adhere to searchResponseSchema.');

    for (const routeObj of response.routes) {
      // server doesn't provide currency yet
      if (response.currency) {
        routeObj.price += ` ${response.currency}`;
      } else {
        routeObj.price += ' $';
      }

      for (const flight of routeObj.route) {
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

  async function subscribe (params) {
    trace(`subscribe(${objToString(params)}), typeof arg=${typeof params}`);

    assertApp(validateSubscriptionReq(params), 'Params do not adhere to subscriptionRequestSchema');

    let response;

    const { latinName: fromAirportLatinName } = getAirport(params.fly_from);
    const { latinName: toAirportLatinName } = getAirport(params.fly_to);

    try {
      response = await jsonRPCRequest('subscribe', params);
    } catch (e) {
      e.userMessage = `Failed to subscribe for flights from airport ${fromAirportLatinName} to airport ${toAirportLatinName}.`;
      throw e;
    }

    assertPeer(validateSubscriptionRes(response), 'Params do not adhere to subscriptionResponseSchema');
    assertPeer(response.status_code >= 1000 && response.status_code < 2000, {
      userMessage: `Already subscribed for flights from ${fromAirportLatinName} to ${toAirportLatinName}.`,
      logs: [
        'Tried to subscribe but subscription already existed.',
        'Sent params: ',
        params,
        'Got response: ',
        response,
      ],
    });

    return params;
  }

  async function unsubscribe (params) {
    trace(`unsubscribe(${objToString(params)}), typeof arg=${typeof params}`);

    assertApp(validateSubscriptionReq(params), 'Params do not adhere to subscriptionRequestSchema');

    let response;

    const { latinName: fromAirportLatinName } = getAirport(params.fly_from);
    const { latinName: toAirportLatinName } = getAirport(params.fly_to);

    try {
      response = await jsonRPCRequest('unsubscribe', params);
    } catch (e) {
      e.userMessage = `Failed to unsubscribe for flights from airport ${fromAirportLatinName} to airport ${toAirportLatinName}.`;
      throw e;
    }

    assertPeer(validateSubscriptionRes(response), 'Params do not adhere to subscriptionResponseSchema');
    assertPeer(response.status_code >= 1000 && response.status_code < 2000, {
      userMessage: `You aren't subscribed for flights from airport ${fromAirportLatinName} to airport ${toAirportLatinName}.`,
      logs: [
        'Server returned unknown status code',
        'Sent params: ',
        params,
        'Got response: ',
        response,
      ],
    });

    return params;
  }

  async function jsonRPCRequest (method, params) {
    trace(`jsonRPCRequest(${method}, ${objToString(params)}), typeof arg1=${typeof method}, typeof arg2=${typeof params}`);

    const request = {
      jsonrpc: '2.0',
      method,
      params: params,
      id: jsonRPCRequestId,
    };
    let response;

    try {
      response = await postJSON(SERVER_URL, request);
    } catch (error) {
      throw new PeerError({
        logs: [
          'failed to make a post request to server API', 'url: ', SERVER_URL,
          'request data: ', request, 'error raised: ', error,
        ],
      });
    }

    // increment id only on successful requests
    jsonRPCRequestId++;

    const logs = ['jsonrpc protocol error', 'sent data: ', request, 'got response', response];
    const errorReport = {logs: logs};

    assertPeer(['jsonrpc', 'id'].every(prop => _.has(response, prop)), errorReport);
    assertPeer(!response.error, errorReport);
    assertPeer(response.result, errorReport);
    assertApp(response.id !== null,
      {
        logs: [
          'Server sent back a null id for request: ', request,
          'Full response is: ', response],
      }
    );

    if (response.id !== request.id) {
      // console.warn('Different id between response and request.');
      // console.warn(
      //   'Ignoring because server always returns id = 1 at the moment.');
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (e) {
      // TODO - check if JSON.stringify threw an error
      throw new PeerError({
        userMessage: 'Service is not available at the moment due to network issues',
        logs: ['Couldn\'t connect to server at url: ', url, 'Sent POST request with data: ', data],
      });
    }

    assertPeer(serverResponse.ok, {
      logs: ['Sent POST request with data: ', data, 'Got NOT OK response back', serverResponse],
    });

    return serverResponse.json();
  }

  function sortRoute (route) {
    function comparison (a, b) {
      return a.dtime - b.dtime;
    }

    const result = route.slice(0);

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
    const monthName = MONTH_NAMES[date.getMonth()];
    const dayName = WEEK_DAYS[date.getDay()];

    return `${dayName} ${date.getDate()} ${monthName}`;
  }

  function setupLoading ($button, $routesList) {
    const step = 5;

    $button.click(() => {
      const loaded = $routesList.children()
        .filter(':visible').length; // SUGGEST store visible and not visible in an array?
      $routesList.children()
        .slice(loaded, loaded + step + 1)
        .show();

      if (loaded + step >= $routesList.children().length) {
        $button.hide();
      }
    });
  }

  function displaySearchResult (searchResult, $routesList, templates) {
    trace(`executing displaySearchResult`);

    const { $flightItemTemplate, $routeItemTemplate } = templates;

    $routesList.find('li:not(:first)')
      .remove();

    if (
      !_.isObject(searchResult) ||
      (Object.keys(searchResult).length === 0 && _.isObject(searchResult))
    ) {
      return;
    }

    if (searchResult.routes.length === 0) {
      $('#load-more-button').hide();
      displayErrorMessage(`There are no known flights.`);
    } else {
      $('#load-more-button').show();
    }

    for (let i = 0; i < searchResult.routes.length; i++) {
      const route = searchResult.routes[i];
      const $clone = $routeItemTemplate.clone();
      const $routeList = $clone.find('ul');
      const $newRoute = fillList($routeList, route.route, $flightItemTemplate);

      if (i < MAX_ROUTES_PER_PAGE) {
        $clone.show();
      }

      $clone.find('.route-price')
        .text(route.price);
      $routesList.append($clone.append($newRoute));

      const $timeElements = $clone.find('time');

      $($timeElements[0])
        .attr('datetime', route.dtime)
        .text(`${weeklyDateString(route.dtime)} ${timeStringFromDate(route.dtime)}`);
      $($timeElements[1])
        .attr('datetime', route.dtime)
        .text(`${weeklyDateString(route.atime)} ${timeStringFromDate(route.atime)}`);
    }
  }

  function fillList ($listTemplate, route, $flightItemTemplate) {
    $listTemplate.find('li:not(:first)')
      .remove();

    for (const flight of route) {
      $listTemplate.append(makeFlightItem(flight, $flightItemTemplate));
    }

    $listTemplate.show();

    return $listTemplate;
  }

  function makeFlightItem (flight, $itemTemplate) {
    trace(`makeFlightItem(${objToString(flight)}, $itemtemplate), typeof flight=${typeof flight}`);

    const $clone = $itemTemplate.clone()
      .removeAttr('id')
      .removeClass('hidden');

    let duration = flight.atime.getTime() - flight.dtime.getTime();

    duration = (duration / 1000 / 60 / 60).toFixed(2);
    duration = (`${duration} hours`).replace(':');

    $clone.find('.airline-logo')
      .attr('src', flight.airline_logo);
    $clone.find('.airline-name')
      .text(flight.airline_name);
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
      .text(`${flight.airport_from} -----> ${flight.airport_to}`);

    return $clone;
  }

  function watchInputField ($inputField, callback) {
    let lastValue = '';

    function callbackOnChange (event) {
      const newVal = $inputField.serialize();
      if (newVal !== lastValue) {
        lastValue = newVal;
        callback(event);
      }
    }

    $inputField.on('keyup', callbackOnChange);
  }

  function setupAutoComplete ({hash, $textInput, $dataList}) {
    const keys = Object.keys(hash)
      .sort();

    watchInputField($textInput, () => {
      const minCharacters = 1;
      const maxSuggestions = 100;

      if ($textInput.val().length < minCharacters) {
        return;
      }

      $dataList.empty();

      let suggestionsCount = 0;

      for (const key of keys) {
        if (suggestionsCount === maxSuggestions) {
          break;
        }

        if (key.indexOf($textInput.val()) !== -1) {
          suggestionsCount += 1;

          const newOption = `<option value="${key}">`;

          $dataList.append(newOption);
        }
      }
    });
  }

  function getSearchFormParams ($searchForm) {
    trace(`executing getSearchFormParams`);

    const searchFormParams = {
      v: '1.0',
    };
    const formData = objectifyForm($searchForm.serializeArray());
    const { id: airportFromId } = getAirport(formData.from);
    const { id: airportToId } = getAirport(formData.to);

    assertUser(
      typeof airportFromId === 'string' &&
      typeof airportToId === 'string', {
        userMessage: 'Please choose your departure airport and arrival airport.',
        logs: [],
      }
    );

    assertPeer(airportFromId, {
      userMessage: `${formData.from} is not a location that has an airport!`,
      logs: ['User entered an invalid string in #arrival-input - ', formData.to],
    });
    assertPeer(airportToId, {
      userMessage: `${formData.to} is not a location that has an airport!`,
    });

    searchFormParams.fly_from = airportFromId;
    searchFormParams.fly_to = airportToId;

    if (formData['price-to']) {
      searchFormParams.price_to = parseInt(formData['price-to']);
    }

    if (formData['date-from']) {
      searchFormParams.date_from = formData['date-from'];
    }

    if (formData['date-to']) {
      searchFormParams.date_to = formData['date-to'];
    }

    trace(`getSearchFormParams returning ${objToString(searchFormParams)}`);
    return searchFormParams;
  }

  function objectifyForm (formArray) {
    return formArray.reduce(
      (obj, entry) => {
        if (entry.value != null && entry.value !== '') { // '' check not needed
          obj[entry.name] = entry.value; // overwrites similar names
        }
        return obj;
      },
      {});
  }

  $(document).ready(() => {
    $errorBar = $('#errorBar');

    const $allRoutesList = $('#all-routes-list'); // consts
    const $routeItemTemplate = $('#flights-list-item-template');
    const $flightItemTemplate = $('#flight-item-template');

    const $flightForm = $('#flight-form-input');

    $('#subscribe-button').click(async () => {
      trace(`Subscribe button clicked`);

      let formParams;
      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      try {
        const response = await subscribe({
          v: formParams.v,
          fly_from: formParams.fly_from,
          fly_to: formParams.fly_to,
        });

        if (response.status_code >= 1000 && response.status_code < 2000) {
          displaySearchResult(
            response,
            $allRoutesList,
            { $routeItemTemplate, $flightItemTemplate }
          );
        } else if (response.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }
      } catch (e) {
        handleError(e);
      }

      return false;
    });

    $('#unsubscribe-button').click(async () => {
      trace(`Unsubscribe button clicked`);

      let formParams;
      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      try {
        const response = await unsubscribe({
          v: formParams.v,
          fly_from: formParams.fly_from,
          fly_to: formParams.fly_to,
        });

        if (response.status_code >= 1000 && response.status_code < 2000) {
          displaySearchResult(
            response,
            $allRoutesList,
            { $routeItemTemplate, $flightItemTemplate }
          );
        } else if (response.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }
      } catch (e) {
        handleError(e);
      }
    });

    $('#submit-button').click(async (event) => {
      trace(`Submit button clicked`);

      event.preventDefault();
      let formParams;

      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      try {
        const response = await search(formParams);

        if (response.status_code >= 1000 && response.status_code < 2000) {
          displaySearchResult(
            response,
            $allRoutesList,
            { $routeItemTemplate, $flightItemTemplate }
          );
        } else if (response.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }
      } catch (e) {
        handleError(e);
      }

      return false;
    });

    $flightForm.on('submit', event => {
      event.preventDefault();
    });

    const airportsByNames = Object.values(AIRPORT_HASH)
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
      hash: airportsByNames,
      $textInput: $('#from-input'),
      $dataList: $('#from-airports'),
    });
    setupAutoComplete({
      hash: airportsByNames,
      $textInput: $('#to-input'),
      $dataList: $('#to-airports'),
    });

    setupLoading($('#load-more-button'), $allRoutesList);
  });

  window.addEventListener('error', (error) => {
    handleError(error);

    // suppress
    return true;
  });

  function handleError (error) {
    console.log(error);

    if (error.userMessage) {
      displayErrorMessage(error.userMessage);
    }
  }
}

start();
