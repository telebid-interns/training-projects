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

let ticketItemTemplate; // initialize DOM elements after document loads
let uiRoutesList;

class ApplicationError extends Error {
    constructor (message) {
        super(message);
        alert('An unknown application error occurred. Please reload the page.<br>' +
            message);
    }
}

class PeerError extends Error {
    constructor (message) {
        super(message);
    }
}

class UserError extends PeerError {
    constructor (message) {
        super(message);
        alert('Good job.<br>' + message);
    }
}

class ExternalError extends PeerError {
    constructor (message, who) {
        super(message);
        alert(who + 'isn\'t working.<br>' + message);
    }
}

AIRPORT_MAP = {
    'SOF': {
        iataID: 'SOF',
        latinName: 'Sofia Airport',
        nationalName: 'Летище София',
        location: {latinName: 'Sofia'},
    },
    'BBU': {
        iataID: 'BBU',
        latinName: 'Aurel Vlaicu',
        nationalName: 'Aurel Vlaicu National',
        location: {latinName: 'Bucurest'},
    },
    'HND': {
        iataID: 'HND',
        latinName: 'Tokyo Haneda International Airport',
        nationalName: '',
        location: {latinName: 'Tokyo'},
    },
};

function fetchRoutes (
    {
        flyFrom,
        flyTo,
        priceTo,
        currency = 'USD',
        dateFrom = new Date(),
        dateTo,
        sort = 'price',
        maxFlyDuration = 6,
    }){
    return {
        currency: 'USD',
        routes: [
            {
                bookingToken: "this here is a very very valid booking token",
                route: [
                    {
                        airportFrom: 'SOF',
                        airportTo: 'BBU',
                        cityFrom: 'Sofia',
                        cityTo: 'Bucarest',
                        price: 20,
                        dtime: new Date("2018-06-28T16:30"),
                        atime: new Date("2018-06-28T17:00"),
                        airlineLogo: "https://www.designevo.com/res/templates/thumb_small/glorious-sunrise-aviation.png",
                        airlineName: "International bureo of investigation of plane crashes",
                        flightNumber: "414HU4KB4R"
                    },
                    {
                        airportFrom: 'BBU',
                        airportTo: 'HND',
                        cityFrom: 'Bucarest',
                        cityTo: 'Tokyo',
                        price: 150,
                        dtime: new Date('2018-07-01T06:30'),
                        atime: new Date('2018-07-01T12:30'),
                        airlineLogo: "https://www.designevo.com/res/templates/thumb_small/glorious-sunrise-aviation.png",
                        airlineName: "International bureo of investigation of plane crashes",
                        flightNumber: 'NAN1'
                    }
                ]
            }
        ]
    }
}


function displayRoutes(routes) {
    function timeStringFromDate(date) {
        return `${date.getUTCHours()}:${date.getUTCMinutes()}`;
    }

    function weeklyDateString(date) {
        let monthName = MONTH_NAMES[date.getMonth()];
        let dayName = WEEK_DAYS[date.getDay()];

        return `${dayName} ${date.getDate()} ${monthName}`;
    }

    function makeListItem(flight) {
        let clone = ticketItemTemplate.clone().
            removeAttr('id').
            removeClass('hidden');
        clone.find('.price').text(flight.price);
        clone.find('.airline-logo').text(); // TODO fill
        clone.find('.airline-name').text('example airline name');
        clone.find('.departure-time').text(timeStringFromDate(flight.dtime));
        clone.find('.arrival-time').text(timeStringFromDate(flight.atime));
        clone.find('.flight-date').text(weeklyDateString(flight.dtime));
        clone.find('.timezone').text('UTC');
        clone.find('.duration').text(flight.duration / 1000 / 60 / 60 + 'hours');
        clone.find('.from-to-display').
            text(
                `${flight.cityFrom} -----> ${flight.cityTo}`);
        return clone;
    }

    uiRoutesList.find('li:not(:first)').remove();
    console.log(routes);
    for (let flight of routes.routes[0]) {
        uiRoutesList.append(makeListItem(flight));
    }
    uiRoutesList.show();
}


function watchInputField (inputField, callback) {
    let lastValue = '';

    function callbackOnChange (event) {
        let newVal = inputField.serialize();
        if (newVal !== lastValue) {
            lastValue = newVal;
            callback(event);
        }
    }

    inputField.on('keyup', callbackOnChange);
}

function setupAutoComplete ({hash, textInput, dataList}) {
    let keys = Object.keys(hash).sort();
    watchInputField(textInput, hinter);

    function hinter () {
        let minCharacters = 1;
        let maxSuggestions = 100;

        if (textInput.val().length < minCharacters) {
            return;
        }

        dataList.empty();
        let suggestionsCount = 0;
        for (let key of keys) {
            if (suggestionsCount === maxSuggestions)
                break;
            if (key.indexOf(textInput.val()) !== -1) {
                suggestionsCount += 1;
                let newOption = `<option value="${key}">`;
                dataList.append(newOption);
                console.log('appended option');
            }
        }

    }
}

$(document).ready(() => {
        ticketItemTemplate = $('#routes-container ul li').first();
        uiRoutesList = $('#routes-container ul');

        let flightForm = $('#flight-form-input');
        let flightFormData = '';

        flightForm.on('submit',
            event => {
                event.preventDefault();

                if (flightForm.serialize() === flightFormData) {
                    return;
                }

                flightFormData = flightForm.serialize();
                displayRoutes(fetchRoutes({}));

                return false;
            });

        let byNames = Object.values(AIRPORT_MAP).reduce((hash, airport) => {
                hash[airport.latinName] = airport;
                hash[airport.nationalName] = airport;
                hash[airport.location.latinName] = airport;
                return hash;
            },
            {});

        setupAutoComplete({
            hash: byNames,
            textInput: $('#from-input'),
            dataList: $('#from-airports'),
        });
        setupAutoComplete({
            hash: byNames,
            textInput: $('#to-input'),
            dataList: $('#to-airports'),
        });
    },
);
