const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'Octomber', 'November', 'December',
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

let $errorBar;

function displayErrorMessage (errMsg) {
    $errorBar.text(errMsg);
}

class BaseError extends Error {
    constructor (userMessage, ...logs) {
        super(userMessage);
        console.warn(...logs);
        displayErrorMessage(userMessage);
    }
}

class ApplicationError extends BaseError {
    constructor (userMessage, ...logs) {
        super(userMessage, ...logs);
        alert(userMessage);
    }
}

class PeerError extends BaseError {
    constructor (userMessage, ...logs) {
        super(userMessage, ...logs);
    }
}

AIRPORT_HASH = {
    'SOF-airport-database-id': {
        dbsID: 'SOF-airport-database-id',
        iataID: 'SOF',
        latinName: 'Sofia Airport',
        nationalName: 'Летище София',
        location: {latinName: 'Sofia'},
    },
    'BBU-airport-database-id': {
        dbsID: 'BBU-airport-database-id',
        iataID: 'BBU',
        latinName: 'Aurel Vlaicu',
        nationalName: 'Aurel Vlaicu National',
        location: {latinName: 'Bucurest'},
    },
    'HND-airport-database-id': {
        dbsID: 'HND-airport-database-id',
        iataID: 'HND',
        latinName: 'Tokyo Haneda International Airport',
        nationalName: '',
        location: {latinName: 'Tokyo'},
    },
};

function getAirportByString (string) {
    for (let airport of Object.values(AIRPORT_HASH)) {
        if (string.toLowerCase() === airport.iataID.toLowerCase())
            return airport;
    }
}

const EXAMPLE_ROUTES = {
    status_code: 1000,
    currency: 'USD',
    routes: [
        {
            booking_token: 'solid booking token',
            price: 170,
            route: [
                {
                    airport_from: 'SOF-airport-database-id',
                    airport_to: 'BBU-airport-database-id',
                    city_from: 'Sofia',
                    city_to: 'Bucarest',
                    dtime: '2018-06-28T16:30',
                    atime: '2018-06-28T17:00',
                    airline_logo: 'https://www.designevo.com/res/templates/thumb_small/glorious-sunrise-aviation.png',
                    airline_name: 'International bureau of investigation of plane crashes',
                    flight_number: '414HU4KB4R',
                },
                {
                    airport_from: 'BBU-airport-database-id',
                    airport_to: 'HND-airport-database-id',
                    city_from: 'Bucarest',
                    city_to: 'Tokyo',
                    dtime: '2018-07-01T06:30',
                    atime: '2018-07-01T12:30',
                    airline_logo: 'https://www.designevo.com/res/templates/thumb_small/glorious-sunrise-aviation.png',
                    airline_name: 'International bureau of investigation of plane crashes',
                    flight_number: 'N4N1',
                },
            ],
        },
        {
            booking_token: 'Solid booking token. Number two.',
            price: 1700,
            route: [
                {
                    airport_from: 'SOF-airport-database-id',
                    airport_to: 'HND-airport-database-id',
                    city_from: 'Sofia',
                    city_to: 'Tokyo',
                    dtime: '2018-06-28T18:30',
                    atime: '2018-06-29T00:00',
                    airline_logo: 'https://www.designevo.com/res/templates/thumb_small/glorious-sunrise-aviation.png',
                    airline_name: 'International bureau of investigation of plane crashes',
                    flight_number: 'SONIC',
                },
            ],
        },
    ],
};

function snakeToCamel (string) {
    let words = string.split('_');
    let top = words[0];

    words.splice(0, 1);

    return top + words.map(_.capitalize).join('');
}

function switchStyle (json, converter) {
    function switchHash (hash) {
        return _.mapKeys(hash, (value, key) => converter(key));
    }

    function switcher (json) {
        let converted = switchHash(json);

        for (let [key, value] of Object.entries(converted)) {
            if ($.isPlainObject(value)) {
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

let jsonRPCRequestId = 1;

/**
 *
 * @param {string} method
 * @param {object} params
 * @returns {Promise<*>}
 */
async function jsonRPCRequest (method, params) {
    let url = '10.20.1.155:3000/?format=json';
    let request = {
        jsonrpc: 2.0,
        method,
        params,
        id: jsonRPCRequestId,
    };
    let response;

    try {
        response = await $.post(url, request, null, 'json');
    } catch (error) {
        throw new PeerError('Service is not available at the moment',
            'failed to make a post request to server API',
            'url: ', url,
            'request data: ', request,
            'error raised: ', error);
    } finally {
        jsonRPCRequestId++;
    }

    if (!['jsonrpc', 'id'].every(prop => _.has(response, prop))) {
        throw new PeerError('Service is not available at the moment',
            'Invalid JSON RPC response from server');
    } else if (_.has(response, 'error')) {
        throw new PeerError('Service is not available at the moment',
            'jsonrpc request failed.',
            'sent data: ', request,
            'got response: ', response);
    } else if (!_.has(response, 'result')) {
        throw new PeerError('Service is not available at the moment',
            'jsonrpc request failed - response has neither \'error\' nor \'result\' properties',
            'sent data: ', request,
            'got response: ', response);
    } else if (response.id !== request.id) {
        throw new ApplicationError(
            'An unexpected behaviour occurred. Please refresh the page.',
            'json rpc response and request id are out of sync',
            'request id =', request.id,
            'response id =', response.id);
    }

    return response;
}

/**
 * Make a search method call to the server and retrieve possible routes
 * All parameters must be JS primitives with their corresponding type in
 * the API docs.
 *
 **/
async function search (
    {
        flyFrom,
        flyTo,
        priceTo,
        currency = 'USD',
        dateFrom,
        dateTo,
        sort,
        maxFlyDuration,
    }) {
    function validateParams (params) {
        const required = ['fly_from', 'fly_to'];
        const fixed = {sort: ['price', 'duration'], currency: ['USD', 'BGN']};

        // TODO this might not be needed if the API can accept undefined values
        for (let [key, value] of Object.entries(params)) {
            if (value === undefined) {
                delete params[key];
            }
        }

        for (let requiredParam of required) {
            if (Object.keys(params).indexOf(requiredParam) === -1)
                throw new ApplicationError(
                    'An unexpected behaviour occurred. Please refresh the page.',
                    'Missing required keyword argument: ', requiredParam,
                    'to call of', search);
        }

        for (let [fixedParam, possibleStates] of Object.entries(fixed)) {
            if (
                Object.keys(params).indexOf(fixedParam) !== -1 &&
                possibleStates.indexOf(params[fixedParam]) === -1
            ) {
                throw new ApplicationError(
                    'An unexpected behaviour occurred. Please refresh the page.',
                    'Paramater', fixedParam,
                    'is not one of:', fixed[fixedParam],
                    'instead got -', params[fixedParam]);
            }
        }

        return params;
    }

    const params = validateParams(
        {
            fly_from: flyFrom,
            fly_to: flyTo,
            price_to: priceTo,
            currency: currency,
            date_from: dateFrom,
            date_to: dateTo,
            sort: sort,
            max_fly_duration: maxFlyDuration,
        },
    );

    console.log('request paramaters are: ', params);

    // let response = await jsonRPCRequest('search', params);
    let response = switchStyle(EXAMPLE_ROUTES, snakeToCamel);

    for (let routeObj of response.routes) {
        routeObj.price += response.currency;

        for (let flight of routeObj.route) {
            flight.dtime = new Date(flight.dtime);
            flight.atime = new Date(flight.atime);
        }

        routeObj.dtime = routeObj.route[0].dtime;
        routeObj.atime = routeObj.route[routeObj.route.length - 1].atime;
    }

    return response;
}

function timeStringFromDate (date) {
    return `${date.getUTCHours()}:${date.getUTCMinutes()}`;
}

function weeklyDateString (date) {
    let monthName = MONTH_NAMES[date.getMonth()];
    let dayName = WEEK_DAYS[date.getDay()];

    return `${dayName} ${date.getDate()} ${monthName}`;
}

function displayRoutes (
    routes, $routesList, $routeItemTemplate, $flightItemTemplate,
) {
    $routesList.find('li:not(:first)').remove();

    for (let route of routes.routes) {
        let $clone = $routeItemTemplate.clone().
            removeAttr('id').
            removeClass('hidden');
        let $routeList = $clone.find('ul');
        let $newRoute = makeFlightList(route.route, $routeList,
            $flightItemTemplate);

        $clone.find('.route-price').text(route.price);
        $routesList.append($clone.append($newRoute));

        let $timeElements = $clone.find('time');

        $($timeElements[0]).attr('datetime', route.dtime).
            text(weeklyDateString(route.dtime) + ' ' +
                timeStringFromDate(route.dtime)
            );
        $($timeElements[1]).attr('datetime', route.dtime).
            text(weeklyDateString(route.atime) + ' ' +
                timeStringFromDate(route.atime)
            );

    }

    function makeFlightList (route, $list, $flightItemTemplate) {
        $list.find('li:not(:first)').remove();

        for (let flight of route) {
            $list.append(makeListItem(flight, $flightItemTemplate));
        }

        $list.show();

        return $list;

        function makeListItem (flight, $itemTemplate) {
            let $clone = $itemTemplate.clone().
                removeAttr('id').
                removeClass('hidden');

            let duration = flight.atime.getTime() - flight.dtime.getTime();

            $clone.find('.airline-logo').text(); // TODO fill
            $clone.find('.airline-name').text('example airline name');
            $clone.find('.departure-time').
                text(timeStringFromDate(flight.dtime));
            $clone.find('.arrival-time').text(timeStringFromDate(flight.atime));
            $clone.find('.flight-date').text(weeklyDateString(flight.dtime));
            $clone.find('.timezone').text('UTC');
            $clone.find('.duration').text(duration / 1000 / 60 / 60 + ' hours');
            $clone.find('.from-to-display').
                text(`${flight.cityFrom} -----> ${flight.cityTo}`);

            return $clone;
        }
    }
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

function setupAutoComplete ({hash, $textInput: $textInput, $dataList: $dataList}) {
    let keys = Object.keys(hash).sort();
    watchInputField($textInput, hinter);

    function hinter () {
        let minCharacters = 1;
        let maxSuggestions = 100;

        if ($textInput.val().length < minCharacters) {
            return;
        }

        $dataList.empty();
        let suggestionsCount = 0;
        for (let key of keys) {
            if (suggestionsCount === maxSuggestions)
                break;
            if (key.indexOf($textInput.val()) !== -1) {
                suggestionsCount += 1;
                let newOption = `<option value="${key}">`;
                $dataList.append(newOption);
                console.log('appended option');
            }
        }

    }
}

$(document).ready(() => {
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
                return;
            }

            flightFormData = $flightForm.serialize();

            let flyFromString = $('#from-input').val();
            let flyToString = $('#to-input').val();
            let flyFrom = getAirportByString(flyFromString) || '';
            let flyTo = getAirportByString(flyToString) || '';

            if (!flyFrom) {
                throw new BaseError(
                    `${flyFrom} is not a location that has an airport!`,
                    'User entered an invalid string in #departure-input - ',
                    flyFrom);
            } else if (!flyTo) {
                throw new BaseError(
                    `${flyTo} is not a location that has an airport!`,
                    'User entered an invalid string in #arrival-input - ',
                    flyTo);
            }

            displayRoutes(await search({flyFrom, flyTo}), $allRoutesList,
                $flightsListTemplate, $flightItemTemplate);

            return false;
        });

    let byNames = Object.values(AIRPORT_HASH).reduce((hash, airport) => {
            hash[airport.latinName] = airport;
            hash[airport.nationalName] = airport;
            hash[airport.location.latinName] = airport;
            return hash;
        },
        {});

    setupAutoComplete({
        hash: byNames,
        $textInput: $('#from-input'),
        $dataList: $('#from-airports'),
    });
    setupAutoComplete({
        hash: byNames,
        $textInput: $('#to-input'),
        $dataList: $('#to-airports'),
    });
});
