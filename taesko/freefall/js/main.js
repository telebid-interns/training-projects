let TICKET_ITEM_TEMPLATE;
let UI_LIST;



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
        alert("You did very well.<br>" + message);
    }
}
class ExternalError extends PeerError{
    constructor(message, who) {
        super(message);
        alert(who + "isn't working.<br>" + message);
    }
}


AIRPORT_MAP = {
    'SOF': {
        icaoId: 'SOF',
        iataID: 'SOF',
        latinName: 'Sofia Aiport',
        nationalName: 'Летище София',
        location: {name: 'София'}
    },
    'LRBS': {icaoID: 'LRBS', iataID: 'BBU', latinName: 'Aurel Vlaicu', nationalName: "Aurel Vlaicu National",},
    'LROP': {}
};


const Airports = {
    byIcao: (icaoId) => {
        return AIRPORT_MAP[icaoId]
    }
};


function paramsAreProvided(required) {
    for(let [name, arg] of Object.entries(required)) {
        if (arg === undefined)
            throw new ApplicationError("Missing required argument: ", name);
    }
}


class Ticket {
    constructor({flyFrom, flyTo, price, departure, arrival}) {
        paramsAreProvided({flyFrom, flyTo, price, departure, arrival});
        this.flyFrom = flyFrom;
        this.flyTo = flyTo;
        this.price = price;
        this.departureTime = departure;
        this.arrivalTime = arrival;
    }

    get itemElement() {
        return TICKET_ITEM_TEMPLATE.clone()
            .removeAttr('id')
            .removeClass('hidden')
            .text(this.flyFrom.latinName + " to " + this.flyTo.latinName);
    }

}


class Route {

    constructor(tickets) {
        this.ticketRoute = tickets;
    }

    static between({from, to, types}) {
        let routeIds = ['SOF', 'LRBS'];
        let tickets = [];
        for (let k = 0; k < routeIds.length - 1; k++)
            tickets.push(
                new Ticket({
                    flyFrom: Airports.byIcao(routeIds[k]), flyTo: Airports.byIcao(routeIds[k + 1]),
                    price: 5, departure: k, arrival: k+1
                })
            );

        return new Route(tickets);
    }

    get flyFrom() {
        return this.ticketRoute.last().flyFrom
    }

    get flyTo() {
        return this.ticketRoute.last().flyTo
    }

    get departureTime() {
        return this.flyFrom.departureTime
    }

    get arrivalTime() {
        return this.flyTo.arrivalTime
    }

    display() {
        for(let ticket of this.ticketRoute) {
            UI_LIST.append(ticket.itemElement);
        }
        UI_LIST.show()
    }

}


$(document).ready( () => {
    TICKET_ITEM_TEMPLATE = $('#routes-container ul li').first();
    UI_LIST = $('#routes-container ul');

    let flightForm = $('#flight-form-input');
    let flightFormData = flightForm.serialize();
    flightForm.on('submit',
        event => {
            event.preventDefault();

            if(flightForm.serialize() === flightFormData)
                return;

            flightFormData = flightForm.serialize();
            Route.between({})
                .display();

            return false;
        })
    }
);
