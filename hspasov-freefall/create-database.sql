DROP TABLE IF EXISTS data_fetches;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS airlines;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS routes_flights;
DROP TABLE IF EXISTS subscriptions;

CREATE TABLE data_fetches (
	id integer PRIMARY KEY,
	timestamp text NOT NULL
);

CREATE TABLE subscriptions (
	id integer PRIMARY KEY,
	fly_from text NOT NULL,
	fly_to text NOT NULL,
	is_roundtrip integer NOT NULL DEFAULT 0,
	UNIQUE(fly_from, fly_to, is_roundtrip),
	CHECK(fly_from <> fly_to)
);

CREATE TABLE routes (
	id integer PRIMARY KEY,
	booking_token text NOT NULL UNIQUE,
	subscription_id integer NOT NULL,
	data_fetch_id integer NOT NULL,
	FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
	FOREIGN KEY(data_fetch_id) REFERENCES data_fetches(id)
);

CREATE TABLE airports (
	id integer PRIMARY KEY,
	iata_code text NOT NULL UNIQUE,
	name text NOT NULL UNIQUE,
	data_fetch_id integer NOT NULL,
	FOREIGN KEY(data_fetch_id) REFERENCES data_fetches(id)
);

CREATE TABLE airlines (
	id integer PRIMARY KEY,
	name text NOT NULL UNIQUE,
	code text NOT NULL UNIQUE,
	logo_url text UNIQUE,
	data_fetch_id integer NOT NULL,
	FOREIGN KEY(data_fetch_id) REFERENCES data_fetches(id) 
);

CREATE TABLE flights (
	id integer PRIMARY KEY,
	airline_id integer NOT NULL,
	flight_number text NOT NULL,
	airport_from_id integer NOT NULL,
	airport_to_id integer NOT NULL,
	dtime text NOT NULL,
	atime text NOT NULL,
	price integer NOT NULL, -- stored as the lowest common unit, e.g. cents, pence, etc.
	currency text NOT NULL,
	remote_id text NOT NULL UNIQUE,
	data_fetch_id integer NOT NULL,
	FOREIGN KEY (airline_id) REFERENCES airlines(id),
	FOREIGN KEY (airport_from_id) REFERENCES airports(id),
	FOREIGN KEY (airport_to_id) REFERENCES airports(id),
	FOREIGN KEY (data_fetch_id) REFERENCES data_fetches(id)   
);

CREATE TABLE routes_flights (
	id integer PRIMARY KEY,
	route_id integer NOT NULL,
	flight_id integer NOT NULL,
	is_return integer NOT NULL,
	data_fetch_id integer NOT NULL,
	FOREIGN KEY (route_id) REFERENCES routes(id),
	FOREIGN KEY (flight_id) REFERENCES flights(id),
	FOREIGN KEY (data_fetch_id) REFERENCES data_fetches(id)
);
