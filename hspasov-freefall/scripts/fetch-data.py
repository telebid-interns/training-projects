from urllib import error
from urllib.parse import urlencode
import urllib.request
import json
import sqlite3
import sys
import re
from datetime import date
from dateutil.relativedelta import relativedelta

ROUTES_LIMIT = 30
# SERVER_TIME_FORMAT = '%'
KIWI_API_DATE_FORMAT = '%d/%m/%Y'

class BaseError(Exception):
    def __init__(self, msg):
        super().__init__(msg)
        self.msg = msg
        handle_error(self.msg)

class AppError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)

class PeerError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)

class UserError(BaseError):
    def __init__(self, msg):
        super().__init__(msg)

def assert_app(condition, msg):
    if not condition:
        raise AppError(msg)

def assert_peer(condition, msg):
    if not condition:
        raise PeerError(msg)

def assert_user(condition, msg):
    if not condition:
        raise UserError(msg)

def handle_error(error):
    log(error)
    sys.exit()

def log(msg):
    print(msg)

def request(URL, params=None):
    assert_app(
        type(URL) is str,
        'Expected url to be str, but was {0}, value "{1}"'.format(type(URL), URL))
    assert_app(
        params is None or type(params) is dict,
        'Expected params to be None or dict, but was {0}, value "{1}"'.format(type(params), params))

    uri = URL;

    if '?' not in URL and params is not None:
        uri += '?'

    if params is not None:
        uri += urlencode(params)

    log(uri)

    try:
        response = urllib.request.urlopen(uri).read()
        parsed = json.loads(response.decode('utf-8'))
    except (error.URLError, UnicodeError, json.JSONDecodeError) as e:
        raise PeerError(e)

    return parsed

def get_subscription_data(airport_end_points, fetchId, offset=0):
    for label, end_point in airport_end_points.items():
        assert_app(
            type(end_point) is str,
            'Expected {0} to be str, but got value "{1}" of type "{2}"'.format(label, end_point, type(end_point)))

    flights_dict = {}
    airports_set = set()

    response = request('https://api.skypicker.com/flights', {
        'flyFrom': airport_end_points['airport_from'],
        'to': airport_end_points['airport_to'],
        'dateFrom': date.today().strftime(KIWI_API_DATE_FORMAT),
        'dateTo': (date.today() + relativedelta(months=+1)).strftime(KIWI_API_DATE_FORMAT),
        'typeFlight': 'oneway',
        'partner': 'picky',
        'v': '2',
        'xml': '0',
        'locale': 'en',
        'offset': offset,
        'limit': ROUTES_LIMIT,
    })

    assert_peer(
        isinstance(response, dict),
        'API sent invalid data response. Expected type dict but got {0}'.format(type(response)))
    expect_response_keys = ['data', 'currency', '_next']

    for key in expect_response_keys:
        assert_peer(key in response, 'Key {0} not found in response'.format(key))
    assert_peer(type(response['currency']) is str, 'Expected currency in response to be str, but was {0}'.format(type(response['currency'])))
    assert_peer(isinstance(response['data'], list), 'Expected data in response to be list, but was {0}'.format(type(response['data'])))

    for route in response['data']:
        assert_peer(isinstance(route, dict), 'Expected route in data to be dict, but was {0}'.format(type(route)))
        expect_route_keys = ['route', 'booking_token', 'price']

        for key in expect_route_keys:
            assert_peer(key in route, 'Key {0} not found in route'.format(key))

        assert_peer(type(route['booking_token']) is str, 'Expected booking_token in route to be str, but was {0}'.format(type(route['booking_token'])))
        assert_peer(type(route['price']) is int, 'Expected price in route to be int but was {0}'.format(type(route['price'])))
        assert_peer(isinstance(route['route'], list), 'Expected route in route to be list, but was {0}'.format(type(route['route'])))

        for flight in route['route']:
            assert_peer(isinstance(flight, dict), 'Expected flight in route item to be dict, but was {0}'.format(type(flight)))
            expect_flight_keys = ['flight_no', 'aTimeUTC', 'dTimeUTC', 'return', 'flyFrom', 'flyTo', 'airline', 'id']

            for key in expect_flight_keys:
                assert_peer(key in flight, 'Key {0} not found in flight'.format(key))

            integer_keys = ['flight_no', 'aTimeUTC', 'dTimeUTC']

            for key in integer_keys:
                assert_peer(type(flight[key]) is int, 'Expected {0} in flight to be int, but was {1}'.format(key, type(flight[key])))

            string_keys = ['flyFrom', 'flyTo', 'airline', 'id']

            for key in string_keys:
                assert_peer(type(flight[key]) is str, 'Expected {0} in flight to be str, but was {1}'.format(key, type(flight[key])))

            assert_peer(flight['return'] in [0, 1], 'Expected return in flight to be 0 or 1, but was {0}'.format(flight['return']))
            assert_peer(flight['flyFrom'] != flight['flyTo'], 'Expected different values for flyFrom and flyTo, but got {0} and {1}'.format(flight['flyFrom'], flight['flyTo']))

            if flight['id'] not in flights_dict:
                flights_dict[flight['id']] = flight
            # TODO - continue from here

conn = sqlite3.connect('../freefall.db')
c = conn.cursor()

# c.execute('SELECT * FROM airports;')
# log(c.fetchall())

airlines = request('https://api.skypicker.com/airlines')

assert_peer(
    isinstance(airlines, list),
    'Expected airlines to be a list, but was "{0}"'.format(type(airlines)))

for airline in airlines:
    assert_peer(
        isinstance(airline, dict),
        'Expected airline to be a dict, but was "{0}"'.format(type(airline)))

    expect_airline_keys = ['id', 'name']

    for key in expect_airline_keys:
        assert_peer(key in airline, 'Key "{0}" not found in airline'.format(key))
        assert_peer(
            type(airline[key]) is str,
            'Expected airline[{0}] "{1}" to be str, but was "{2}"'.format(key, airline[key], type(airline[key])))

    # check for FakeAirline:
    if airline['id'] == '__':
        continue

    iata_code_pattern = re.compile('^[A-Z0-9]+$')

    assert_peer(iata_code_pattern.match(airline['id']), 'Invalid iata code "{0}"'.format(airline['id']))

    log('Inserting if not exists airline {0} ({1})...'.format(airline['name'], airline['id']))

    # TODO insertIfNotExists in airlines
    log(airline)

# TODO get subscriptions
subscriptions = [
    {
        'id': 1,
        'airport_from_id': 2,
        'airport_to_id': 3
    },
    {
        'id': 2,
        'airport_from_id': 1,
        'airport_to_id': 3
    },
]
assert_app(
    isinstance(subscriptions, list),
    'Expected subscriptions to be a list, but was "{0}"'.format(type(subscriptions)))


for sub in subscriptions:
    assert_app(
        isinstance(sub, dict),
        'Expected subscription to be a dict, but was "{0}"'.format(type(sub)))

    expect_subscription_keys = ['id', 'airport_from_id', 'airport_to_id']

    for key in expect_subscription_keys:
        assert_app(key in sub, 'Key "{0}" not found in subscription'.format(key))
        assert_app(
            type(sub[key]) is int,
            'Expected sub[{0}] "{1}" to be int, but was "{2}"'.format(key, sub[key], type(sub[key])))

    # TODO insertDatafetch
    fetch_id = 3

    #TODO select airport_from and airport_to
    airport_from = 'SOF'
    airport_to = 'SFO'

    log(sub)

    get_subscription_data({'airport_from': airport_from, 'airport_to': airport_to}, fetch_id)

# print(airlines[0]['id'])

# assert_app(False, 'it works')
