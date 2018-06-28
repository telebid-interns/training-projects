const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const WEEK_DAYS = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

let ticketItemTemplate; // initialize DOM elements after document loads
let uiRoutesList;


class ApplicationError extends Error {
    constructor(message) {
        super(message);
        alert("An unknown application error occurred. Please reload the page.<br>" + message);
    }
}

class PeerError extends Error {
    constructor(message) {
        super(message);
    }
}

class UserError extends PeerError {
    constructor(message) {
        super(message);
        alert("Good job.<br>" + message);
    }
}

class ExternalError extends PeerError {
    constructor(message, who) {
        super(message);
        alert(who + "isn't working.<br>" + message);
    }
}


AIRPORT_MAP = {
    'SOF': {
        icaoId: 'SOF',
        iataID: 'SOF',
        latinName: 'Sofia Airport',
        nationalName: 'Летище София',
        location: {latinName: 'Sofia'}
    },
    'LRBS': {
        icaoID: 'LRBS',
        iataID: 'BBU',
        latinName: 'Aurel Vlaicu',
        nationalName: "Aurel Vlaicu National",
        location: {latinName: 'Bucurest'}
    },
    'RJTT': {
        icaoId: 'RJTT',
        iataID: 'HND',
        latinName: 'Tokyo Haneda International Airport',
        nationalName: '',
        location: {latinName: 'Tokyo'}
    }
};


class Airports {
    constructor() {
        this.airports = AIRPORT_MAP;
    }

    get hash() {
        return this.airports;
    }

    byIcao(icaoId) {
        return this.airports[icaoId];
    }

    byIata(iataId) {
        for (let airport of Object.values(iataId)) {
            if (airport.iataID === iataId)
                return airport
        }
        return undefined;
    }
}

function paramsAreProvided(required) {
    for (let [name, arg] of Object.entries(required)) {
        console.log(name, arg);
        if (arg === undefined) {
            console.log("passed parameters are invalid: ", required);
            throw new ApplicationError("Missing required argument: ", JSON.stringify(name));
        }
    }
}


class Ticket {
    constructor({flyFrom, flyTo, price, departure, arrival}) {
        paramsAreProvided({flyFrom, flyTo, price, departure, arrival});
        this.flyFrom = flyFrom;
        this.flyTo = flyTo;
        this.price = price;
        this.departureDate = departure;
        this.arrivalDate = arrival;
    }

    get duration() {
        // in miliseconds
        return this.arrivalDate - this.departureDate;
    }

    get durationString() {
        return this.duration / 1000 / 60 / 60 + ' hours';
    }

    static timeStringFromDate(date) {
        return `${date.getUTCHours()}:${date.getUTCMinutes()}`;
    }

    get departureTimeString() {
        return Ticket.timeStringFromDate(this.departureDate);
    }

    get arrivalTimeString() {
        return Ticket.timeStringFromDate(this.arrivalDate);
    }

    static weeklyDateString(date) {
        console.log("date", date.getMonth(), date.getDay());

        let monthName = MONTH_NAMES[date.getMonth()];
        let dayName = WEEK_DAYS[date.getDay()];

        console.log("dateString", monthName, dayName);
        return `${dayName} ${date.getDate()} ${monthName}`;
    }

    get flightDateString() {
        return Ticket.weeklyDateString(this.departureDate);
    }

    get itemElement() {
        let clone = ticketItemTemplate.clone()
            .removeAttr('id')
            .removeClass('hidden');
        clone.find('.price').text(this.price);
        clone.find('.airline-logo').text(); // TODO fill
        clone.find('.airline-name').text('example airline name');
        clone.find('.departure-time').text(this.departureTimeString);
        clone.find('.arrival-time').text(this.arrivalTimeString);
        clone.find('.flight-date').text(this.flightDateString);
        clone.find('.timezone').text('UTC')
        clone.find('.duration').text(this.durationString);
        clone.find('.from-to-display').text(`${this.flyFrom.location.latinName} -----> ${this.flyTo.location.latinName}`);
        return clone;
    }

}


class Route {

    constructor(tickets) {
        this.ticketRoute = tickets;
    }

    static between({from, to, types}) {
        let airports = new Airports();
        let routeIds = ['SOF', 'LRBS', 'RJTT'];
        let dates = [
            [new Date('2018-06-30T11:30'), new Date('2018-06-30T15:30')],
            [new Date('2018-07-01T5:30'), new Date('2018-07-01T10:30')]];
        let tickets = [];
        let k;
        for (k = 0; k < routeIds.length - 1; k++) {
            tickets.push(
                new Ticket({
                    flyFrom: airports.byIcao(routeIds[k]), flyTo: airports.byIcao(routeIds[k + 1]),
                    price: 5, departure: dates[k][0], arrival: dates[k][1]
                })
            );
        }
        return new Route(tickets);
    }

    display() {
        uiRoutesList.find('li:not(:first)').remove();
        for (let ticket of this.ticketRoute) {
            uiRoutesList.append(ticket.itemElement);
        }
        uiRoutesList.show();
    }

}


function watchInputField(inputField, callback) {
    let lastValue = '';

    function callbackOnChange(event) {
        let newVal = inputField.serialize();
        if (newVal !== lastValue) {
            lastValue = newVal;
            callback(event);
        }
    }

    inputField.on('keyup', callbackOnChange);
}


function setupAutoComplete({hash, textInput, dataList}) {
    let keys = Object.keys(hash).sort();
    watchInputField(textInput, hinter);

    function hinter(event) {
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
                console.log("appended option");
            }
        }

    }
}


$(document).ready(() => {
        ticketItemTemplate = $('#routes-container ul li').first();
        uiRoutesList = $('#routes-container ul');

        let flightForm = $('#flight-form-input');
        let flightFormData = '';
        let airports = new Airports();

        flightForm.on('submit',
            event => {
                event.preventDefault();

                if (flightForm.serialize() === flightFormData) {
                    return;
                }

                flightFormData = flightForm.serialize();
                Route.between({})
                    .display();

                return false;
            });


        let byNames = Object.values(airports.hash)
            .reduce((hash, airport) => {
                    hash[airport.latinName] = airport;
                    hash[airport.nationalName] = airport;
                    hash[airport.location.latinName] = airport;
                    return hash
                },
                {});

        setupAutoComplete({
            hash: byNames,
            textInput: $('#from-input'),
            dataList: $('#from-airports')
        });
        setupAutoComplete({
            hash: byNames,
            textInput: $('#to-input'),
            dataList: $('#to-airports')
        });
    }
);
