'use strict';

function start () {
  function BaseError (messages, shouldSend) {
    Error.call(this, messages.msg);

    this.userMessage = messages.userMessage;
    this.msg = messages.msg;

    shouldSend &&
    sendError({
      msg: messages.msg,
      trace: traceLog,
    }, 'jsonrpc');
  }

  BaseError.prototype = Object.create(Error.prototype);
  BaseError.prototype.constructor = BaseError;

  function ApplicationError (messages) {
    BaseError.call(this, messages, true);
  }

  ApplicationError.prototype = Object.create(BaseError.prototype);
  ApplicationError.prototype.constructor = ApplicationError;

  function PeerError (messages) {
    BaseError.call(this, messages, true);
  }

  PeerError.prototype = Object.create(BaseError.prototype);
  PeerError.prototype.constructor = PeerError;

  function UserError (messages) {
    BaseError.call(this, messages, true);
  }

  UserError.prototype = Object.create(BaseError.prototype);
  UserError.prototype.constructor = UserError;

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

  function idGenerator () {
    var requestId = 1; // eslint-disable-line no-var

    return function () {
      return requestId++;
    };
  }

  const MAX_ROUTES_PER_PAGE = 5;
  // const SERVER_URL = 'http://10.20.1.139:3000';
  const SERVER_URL = 'http://127.0.0.1:3000';
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
  const MAX_TRACE = 300;
  var $errorBar; // eslint-disable-line no-var
  const errorMessagesQueue = [];
  const validateSearchReq = getValidateSearchReq();
  const validateSearchRes = getValidateSearchRes();
  const validateSubscriptionReq = getValidateSubscriptionReq();
  const validateSubscriptionRes = getValidateSubscriptionRes();
  const validateSendErrorReq = getValidateSendErrorReq();
  const validateSendErrorRes = getValidateSendErrorRes();
  const traceLog = [];

  const getParser = defineParsers([jsonParser, yamlParser]);
  const getId = idGenerator();

  function trace (msg) {
    if (traceLog.length > MAX_TRACE) {
      traceLog.shift();
    }
    traceLog.push(msg);
  }

  (function setupErrorMessages () {
    setInterval(function () { // eslint-disable-line prefer-arrow-callback
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

  const AIRPORT_HASH = airportDump();

  function getAirport (term) {
    trace('getAirport(' + term + '), typeof arg=' + typeof term); // eslint-disable-line prefer-template

    assertApp(typeof term === 'string', 'In getAirport expected term to be string, but got ' + typeof term + ', term = "' + term + '"'); // eslint-disable-line prefer-template

    term = term.toLowerCase();

    var key, i; // eslint-disable-line no-var
    var airports = []; // eslint-disable-line no-var

    for (key in AIRPORT_HASH) {
      if (Object.prototype.hasOwnProperty.call(AIRPORT_HASH, key)) {
        airports.push(AIRPORT_HASH[key]);
      }
    }

    for (i = 0; i < airports.length; i++) {
      const strings = [
        airports[i].id,
        airports[i].iataID.toLowerCase(),
        airports[i].latinName.toLowerCase(),
        airports[i].nationalName.toLowerCase(),
        airports[i].cityName.toLowerCase(),
      ];

      if (_.includes(strings, term)) {
        trace('getAirport(' + term + ') returning ' + strings.join(',') + ''); // eslint-disable-line prefer-template
        return airports[i];
      }
    }
    trace('getAirport(' + term + ') returning undefined'); // eslint-disable-line prefer-template
    throw new UserError({
      userMessage: 'Could not find an airport. Please try again.',
      msg: 'Term \'' + term + '\', provided by user, could not be resolved to an airport', // eslint-disable-line prefer-template
    });
  }

  /**
   * Make a search method call to the server and retrieve possible routes
   * All parameters must be JS primitives with their corresponding type in
   * the API docs.
   *
   **/
  function search (params, protocolName, callback) {
    trace('search(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    assertApp(validateSearchReq(params), {
      msg: 'Params do not adhere to searchRequestSchema.',
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'search',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      assertPeer(validateSearchRes(result), {
        msg: 'Params do not adhere to searchResponseSchema.',
      });

      var i, k; // eslint-disable-line no-var

      for (i = 0; i < result.routes.length; i++) {
        // server doesn't provide currency yet
        if (result.currency) {
          result.routes[i].price += ' ' + result.currency + ''; // eslint-disable-line prefer-template
        } else {
          result.routes[i].price += ' $';
        }

        for (k = 0; k < result.routes[i].route.length; k++) {
          result.routes[i].route[k].dtime = new Date(result.routes[i].route[k].dtime);
          result.routes[i].route[k].atime = new Date(result.routes[i].route[k].atime);

          // server doesn't provide city_from and city_to yet
          result.routes[i].route[k].cityFrom = result.routes[i].route[k].cityFrom || '';
          result.routes[i].route[k].cityTo = result.routes[i].route[k].cityTo || '';
        }

        result.routes[i].route = sortRoute(result.routes[i].route);
        result.routes[i].dtime = result.routes[i].route[0].dtime;
        result.routes[i].atime = result.routes[i].route[result.routes[i].route.length - 1].atime;
      }

      result.routes = _.sortBy(result.routes, [function (routeObj) {
        return routeObj.dtime;
      }]);

      callback(result);
    });
  }

  function subscribe (params, protocolName, callback) {
    trace('subscribe(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    assertApp(validateSubscriptionReq(params), {
      msg: 'Params do not adhere to subscriptionRequestSchema',
    });

    const { latinName: fromAirportLatinName } = getAirport(params.fly_from);
    const { latinName: toAirportLatinName } = getAirport(params.fly_to);

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'subscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      assertPeer(validateSubscriptionRes(result), {
        msg: 'Params do not adhere to subscriptionResponseSchema',
      });
      assertUser(result.status_code >= 1000 && result.status_code < 2000, {
        userMessage: 'Already subscribed for flights from ' + fromAirportLatinName + ' to ' + toAirportLatinName + '.', // eslint-disable-line prefer-template
        msg: 'Tried to subscribe but subscription already existed. Sent params: ' + params + '. Got result: ' + result + '', // eslint-disable-line prefer-template
      });

      callback(params);
    });
  }

  function unsubscribe (params, protocolName, callback) {
    trace('unsubscribe(' + JSON.stringify(params) + '), typeof arg=' + typeof params + ''); // eslint-disable-line prefer-template

    const { email } = params;

    assertApp(validateSubscriptionReq(params), {
      msg: 'Params do not adhere to subscriptionRequestSchema',
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'unsubscribe',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      assertPeer(validateSubscriptionRes(result), {
        msg: 'Params do not adhere to subscriptionResponseSchema',
      });
      assertUser(result.status_code >= 1000 && result.status_code < 2000, {
        userMessage: 'There was no subscription with email ' + email + '.', // eslint-disable-line prefer-template
        msg: 'Server returned ' + result.status_code + ' status code. Sent params: ' + params + '. Got result: ' + result + '', // eslint-disable-line prefer-template
      });

      callback(params);
    });
  }

  function sendError (params, protocolName) {
    assertApp(validateSendErrorReq(params), {
      msg: 'Params do not adhere to sendErrorRequestSchema',
    });

    sendRequest({
      url: SERVER_URL,
      data: {
        method: 'senderror',
        params: params,
      },
      protocolName: protocolName,
    }, function (result, error) { // eslint-disable-line prefer-arrow-callback
      assertPeer(validateSendErrorRes(result), {
        msg: 'Params do not adhere to sendErrorResponseSchema',
      });
    });
  }

  function sendRequest (requestData, callback) {
    var url = requestData.url; // eslint-disable-line no-var
    var data = requestData.data; // eslint-disable-line no-var
    var protocolName = requestData.protocolName; // eslint-disable-line no-var
    var xhr = new window.XMLHttpRequest(); // eslint-disable-line no-var
    var parser = getParser(protocolName); // eslint-disable-line no-var

    xhr.onreadystatechange = function () { // eslint-disable-line prefer-arrow-callback
      if (xhr.readyState === window.XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const responseParsed = parser.parseResponse(xhr.tesponseText);
          callback(responseParsed.result || null, responseParsed.error || null); // TODO handle error;
        } else if (xhr.status !== 204) {
          handleError('Service is not available at the moment due to network issues');
        }
      }
    };

    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', parser.contentType);
    xhr.withCredentials = true;
    xhr.send(parser.stringifyRequest(data, getId()));
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
    return '' + hours + ':' + minutes + ''; // eslint-disable-line prefer-template
  }

  function weeklyDateString (date) {
    const monthName = MONTH_NAMES[date.getMonth()];
    const dayName = WEEK_DAYS[date.getDay()];

    return '' + dayName + ' ' + date.getDate() + ' ' + monthName + ''; // eslint-disable-line prefer-template
  }

  function setupLoading ($button, $routesList) {
    const step = 5;

    $button.click(function () { // eslint-disable-line prefer-arrow-callback
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
    trace('executing displaySearchResult');

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
      displayErrorMessage('There are no known flights.');
    } else {
      $('#load-more-button').show();
    }

    var i; // eslint-disable-line no-var
    for (i = 0; i < searchResult.routes.length; i++) {
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
        .text('' + weeklyDateString(route.dtime) + ' ' + timeStringFromDate(route.dtime) + ''); // eslint-disable-line prefer-template
      $($timeElements[1])
        .attr('datetime', route.dtime)
        .text('' + weeklyDateString(route.atime) + ' ' + timeStringFromDate(route.atime) + ''); // eslint-disable-line prefer-template
    }
  }

  function fillList ($listTemplate, route, $flightItemTemplate) {
    $listTemplate.find('li:not(:first)')
      .remove();

    var i; // eslint-disable-line no-var

    for (i = 0; i < route.length; i++) {
      $listTemplate.append(makeFlightItem(route[i], $flightItemTemplate));
    }

    $listTemplate.show();

    return $listTemplate;
  }

  function makeFlightItem (flight, $itemTemplate) {
    const $clone = $itemTemplate.clone()
      .removeAttr('id')
      .removeClass('hidden');

    var duration = flight.atime.getTime() - flight.dtime.getTime(); // eslint-disable-line no-var

    duration = (duration / 1000 / 60 / 60).toFixed(2);
    duration = ('' + duration + ' hours').replace(':'); // eslint-disable-line prefer-template

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
      .text('' + flight.airport_from + ' -----> ' + flight.airport_to + ''); // eslint-disable-line prefer-template

    return $clone;
  }

  function getSearchFormParams ($searchForm) {
    trace('executing getSearchFormParams');

    const searchFormParams = {
      v: '1.0', // TODO move to another function, this should not be here
    };
    const formData = objectifyForm($searchForm.serializeArray());

    assertApp(
      _.isObject(formData), {
        msg: 'formData is not an object',
      }
    );

    assertUser(
      typeof formData.from === 'string' &&
      typeof formData.to === 'string', {
        userMessage: 'Please choose your departure airport and arrival airport.',
        msg: 'User did not select flight from or flight to.',
      }
    );

    const { id: airportFromId } = getAirport(formData.from);
    const { id: airportToId } = getAirport(formData.to);

    assertUser(airportFromId, {
      userMessage: '' + formData.from + ' is not a location that has an airport!', // eslint-disable-line prefer-template
      msg: 'User entered a string in departure input, that cannot be resolved to an airport - ' + formData.from + '', // eslint-disable-line prefer-template
    });
    assertUser(airportToId, {
      userMessage: '' + formData.to + ' is not a location that has an airport!', // eslint-disable-line prefer-template
      msg: 'User entered a string in arrival input, that cannot be resolved to an airport - ' + formData.to + '', // eslint-disable-line prefer-template
    });

    searchFormParams.fly_from = airportFromId;
    searchFormParams.fly_to = airportToId;
    searchFormParams.format = formData.format;

    if (formData['price-to']) {
      searchFormParams.price_to = parseInt(formData['price-to']);
    }

    if (formData['date-from']) {
      searchFormParams.date_from = formData['date-from'];
    }

    if (formData['date-to']) {
      searchFormParams.date_to = formData['date-to'];
    }

    trace('getSearchFormParams returning ' + JSON.stringify(searchFormParams) + ''); // eslint-disable-line prefer-template
    return searchFormParams;
  }

  function objectifyForm (formArray) {
    return formArray.reduce(function (obj, entry) { // eslint-disable-line prefer-arrow-callback
      if (entry.value != null && entry.value !== '') { // '' check not needed
        obj[entry.name] = entry.value; // overwrites similar names
      }
      return obj;
    },
    {});
  }

  function yamlParser () {
    const parseYAML = function (yaml) {
      try {
        return jsyaml.safeLoad(yaml);
      } catch (error) {
        throw new PeerError({
          msg: 'Invalid yamlrpc format. Cannot parse YAML.',
        });
      }
    };

    const normalizeYAMLRequest = function (yaml) {
      assertPeer(
        _.isObject(yaml) &&
        _.isObject(yaml.parameters) &&
        typeof yaml.yamlrpc === 'string' &&
        typeof yaml.action === 'string', {
          msg: 'Invalid yamlrpc request format.',
        }
      );

      return {
        yamlrpc: yaml.yamlrpc,
        method: yaml.action,
        params: yaml.parameters,
        id: yaml.id,
      };
    };

    const normalizeYAMLResponse = function (yaml) {
      assertPeer(
        _.isObject(yaml) &&
        (
          (!_.isObject(yaml.result) && _.isObject(yaml.error)) ||
          (_.isObject(yaml.result) && !_.isObject(yaml.error))
        ) &&
        typeof yaml.yamlrpc === 'string', {
          msg: 'Invalid yamlrpc response format.',
        }
      );

      const normalized = {
        id: yaml.id,
        yamlrpc: yaml.yamlrpc,
      };

      if (_.isObject(yaml.result)) {
        normalized.result = yaml.result;
      } else {
        normalized.error = yaml.error;
      }

      return normalized;
    };

    const stringifyYAML = function (yaml) {
      try {
        return jsyaml.safeDump(yaml);
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    const parseRequest = function (data) {
      const normalized = normalizeYAMLRequest(parseYAML(data));
      normalized.version = normalized.yamlrpc;
      return normalized;
    };

    const parseResponse = function (response) {
      const normalized = normalizeYAMLResponse(parseYAML(response));
      return normalized;
    };

    const stringifyResponse = function (data, id = null, yamlrpc = '2.0') {
      return stringifyYAML({
        result: data,
        yamlrpc: yamlrpc,
        id: id,
      });
    };

    const stringifyRequest = function (data, id = null, yamlrpc = '2.0') {
      const { method, params } = data;
      return stringifyYAML({
        action: method,
        parameters: params,
        yamlrpc: yamlrpc,
        id: id,
      });
    };

    const error = function (error, yamlrpc = '2.0') {
      return stringifyYAML({
        yamlrpc: yamlrpc,
        error: error,
        id: null,
      });
    };

    return {
      name: 'yamlrpc',
      contentType: 'text/yaml',
      format: 'yaml',
      parseRequest: parseRequest,
      parseResponse: parseResponse,
      stringifyResponse: stringifyResponse,
      stringifyRequest: stringifyRequest,
      error: error,
    };
  }

  function jsonParser () {
    const parseRequest = function (data) {
      data.version = data.jsonrpc;
      return data;
    };

    const parseResponse = function (response) {
      const data = JSON.parse(response);
      data.version = data.jsonrpc;
      return data;
    };

    const stringifyRequest = function (data, id = null, jsonrpc = '2.0') {
      const { method, params } = data;
      return JSON.stringify({
        method: method,
        params: params,
        jsonrpc: jsonrpc,
        id: id,
      });
    };

    const stringifyResponse = function (data, id = null, jsonrpc = '2.0') {
      try {
        return JSON.stringify({
          jsonrpc: jsonrpc,
          id: id,
          result: data,
        });
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    const error = function (error, jsonrpc = '2.0') {
      try {
        return JSON.stringify({
          jsonrpc: jsonrpc,
          error: error,
          id: null,
        });
      } catch (error) {
        throw new ApplicationError({
          msg: error,
        });
      }
    };

    return {
      name: 'jsonrpc',
      contentType: 'application/json',
      format: 'json',
      parseRequest: parseRequest,
      parseResponse: parseResponse,
      stringifyResponse: stringifyResponse,
      stringifyRequest: stringifyRequest,
      error: error,
    };
  }

  function defineParsers (args) {
    const parsers = args.map(function (arg) { // eslint-disable-line prefer-arrow-callback
      return arg();
    });

    const getParser = function (parsers) {
      return function (name) {
        assertApp(typeof name === 'string', {
          msg: 'Can\'t get parser \'' + name + '\', typeof=' + typeof name + '', // eslint-disable-line prefer-template
        });

        var i; // eslint-disable-line no-var

        for (i = 0; i < parsers.length; i++) {
          if (parsers[i].name === name) {
            return parsers[i];
          }
        }

        throw new ApplicationError({
          msg: 'No parser with name \'' + name + '\'', // eslint-disable-line prefer-template
        });
      };
    };

    return getParser(parsers);
  }

  $(document).ready(function () { // eslint-disable-line prefer-arrow-callback
    // $('#test').autocomplete();
    $errorBar = $('#errorBar');

    const $allRoutesList = $('#all-routes-list'); // consts
    const $routeItemTemplate = $('#flights-list-item-template');
    const $flightItemTemplate = $('#flight-item-template');

    const $flightForm = $('#flight-form');
    const $subscribeForm = $('#subscribe-form');
    const $unsubscribeForm = $('#unsubscribe-form');

    const subscribeBtn = $('#subscribe-button');
    const unsubscribeBtn = $('#unsubscribe-button');
    const submitBtn = $('#submit-button');

    subscribeBtn.click(function (e) { // eslint-disable-line prefer-arrow-callback
      e.preventDefault();
      trace('Subscribe button clicked');

      subscribeBtn.prop('disabled', true);

      const formParams = $subscribeForm
        .serializeArray()
        .reduce(function (acc, current) { // eslint-disable-line prefer-arrow-callback
          assertApp(_.isObject(current), 'Form parameter "' + current + '" not an object'); // eslint-disable-line prefer-template
          assertApp(typeof current.name === 'string', 'Expected name of form parameter to be string, but got ' + typeof current.name + ', name = ' + current.name + ''); // eslint-disable-line prefer-template
          assertApp(typeof current.value === 'string', 'Expected value of form parameter to be string, but got ' + typeof current.value + ', value = ' + current.value + ''); // eslint-disable-line prefer-template

          if (current.value.length <= 0) {
            return acc;
          }

          if (current.name === 'email') {
            acc.email = current.value;
          } else if (current.name === 'from') {
            acc.fly_from = current.value;
          } else if (current.name === 'to') {
            acc.fly_to = current.value;
          } else if (current.name === 'date-from') {
            acc.date_from = current.value;
          } else if (current.name === 'date-to') {
            acc.date_to = current.value;
          } else {
            throw new ApplicationError({
              msg: 'Invalid subscribe form param "' + current.name + '"', // eslint-disable-line prefer-template
            });
          }

          return acc;
        }, {});

      const params = formParams;
      params.v = '2.0';

      subscribe(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
        if (result.status_code >= 1000 && result.status_code < 2000) {
          displaySearchResult(
            result,
            $allRoutesList,
            {
              $routeItemTemplate: $routeItemTemplate,
              $flightItemTemplate: $flightItemTemplate,
            }
          );
        } else if (result.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }

        subscribeBtn.prop('disabled', false);
      });
    });

    unsubscribeBtn.click(function (e) { // eslint-disable-line prefer-arrow-callback
      e.preventDefault();
      trace('Unsubscribe button clicked');

      unsubscribeBtn.prop('disabled', true);

      const formParams = $unsubscribeForm
        .serializeArray()
        .reduce(function (acc, current) { // eslint-disable-line prefer-arrow-callback
          assertApp(_.isObject(current), 'Form parameter "' + current + '" not an object'); // eslint-disable-line prefer-template
          assertApp(typeof current.name === 'string', 'Expected name of form parameter to be string, but got ' + typeof current.name + ', name = ' + current.name + ''); // eslint-disable-line prefer-template
          assertApp(typeof current.value === 'string', 'Expected value of form parameter to be string, but got ' + typeof current.value + ', value = ' + current.value + ''); // eslint-disable-line prefer-template

          if (current.value.length <= 0) {
            return acc;
          }

          if (current.name === 'email') {
            acc.email = current.value;
          } else {
            throw new ApplicationError('Invalid unsubscribe form param ' + current.name + ''); // eslint-disable-line prefer-template
          }

          return acc;
        }, {});

      const params = formParams;
      params.v = '2.0';

      unsubscribe(params, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
        if (result.status_code >= 1000 && result.status_code < 2000) {
          displaySearchResult(
            result,
            $allRoutesList,
            {
              $routeItemTemplate: $routeItemTemplate,
              $flightItemTemplate: $flightItemTemplate,
            }
          );
        } else if (result.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }

        unsubscribeBtn.prop('disabled', false);
      });
    });

    submitBtn.click(function (event) { // eslint-disable-line prefer-arrow-callback
      trace('Submit button clicked');

      event.preventDefault();

      submitBtn.prop('disabled', true);

      var formParams; // eslint-disable-line no-var

      try {
        formParams = getSearchFormParams($flightForm);
      } catch (e) {
        handleError(e);
        return false;
      }

      search(formParams, 'jsonrpc', function (result) { // eslint-disable-line prefer-arrow-callback
        if (result.status_code >= 1000 && result.status_code < 2000) {
          displaySearchResult(
            result,
            $allRoutesList,
            {
              $routeItemTemplate: $routeItemTemplate,
              $flightItemTemplate: $flightItemTemplate,
            }
          );
        } else if (result.status_code === 2000) {
          displayErrorMessage('There is no information about this flight at the moment. Please come back in 15 minutes.');
        }

        submitBtn.prop('disabled', false);
      });
    });

    $flightForm.on('submit', function (event) { // eslint-disable-line prefer-arrow-callback
      event.preventDefault();
    });

    var key; // eslint-disable-line no-var
    var airportHashValues = []; // eslint-disable-line no-var

    for (key in AIRPORT_HASH) {
      if (Object.prototype.hasOwnProperty.call(AIRPORT_HASH, key)) {
        airportHashValues.push(AIRPORT_HASH[key]);
      }
    }

    const airportsByNames = airportHashValues
      .reduce(function (hash, airport) { // eslint-disable-line prefer-arrow-callback
        hash[airport.latinName] = airport;
        hash[airport.nationalName] = airport;
        hash[airport.cityName] = airport;
        return hash;
      },
      {}
      );

      console.log(airportsByNames);
      console.log(AIRPORT_HASH);

    $('#from-input').autocomplete(airportsByNames);
    $('#to-input').autocomplete(airportsByNames);
    setupLoading($('#load-more-button'), $allRoutesList);
  });

  window.addEventListener('error', function (error) { // eslint-disable-line prefer-arrow-callback
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
