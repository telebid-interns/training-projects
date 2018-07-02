DROP TABLE IF EXISTS fetches;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS airlines;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS routes_flights;
DROP TABLE IF EXISTS subscriptions;

CREATE TABLE airports (
	id integer PRIMARY KEY,
	iata_code text NOT NULL UNIQUE,
	name text NOT NULL UNIQUE
);

CREATE TABLE airlines (
	id integer PRIMARY KEY,
	name text NOT NULL UNIQUE,
	code text NOT NULL UNIQUE,
	logo_url text UNIQUE
);

CREATE TABLE subscriptions (
	id integer PRIMARY KEY,
	airport_from_id integer NOT NULL,
	airport_to_id integer NOT NULL,
	is_roundtrip integer NOT NULL DEFAULT 0,
	UNIQUE(airport_from_id, airport_to_id, is_roundtrip),
	CHECK(airport_from_id <> airport_to_id),
	FOREIGN KEY(airport_from_id) REFERENCES airports(id),
	FOREIGN KEY(airport_to_id) REFERENCES airports(id)
);

CREATE TABLE fetches (
	id integer PRIMARY KEY,
	timestamp text NOT NULL,
	subscription_id integer NOT NULL,
	FOREIGN KEY(subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE routes (
	id integer PRIMARY KEY,
	booking_token text NOT NULL UNIQUE,
	fetch_id integer NOT NULL,
	price integer NOT NULL, -- stored as cents
	FOREIGN KEY(fetch_id) REFERENCES fetches(id)
);

CREATE TABLE flights (
	id integer PRIMARY KEY,
	airline_id integer NOT NULL,
	flight_number text NOT NULL,
	airport_from_id integer NOT NULL,
	airport_to_id integer NOT NULL,
	dtime text NOT NULL,
	atime text NOT NULL,
	remote_id text NOT NULL UNIQUE,
	FOREIGN KEY (airline_id) REFERENCES airlines(id),
	FOREIGN KEY (airport_from_id) REFERENCES airports(id),
	FOREIGN KEY (airport_to_id) REFERENCES airports(id),
	CHECK(airport_from_id <> airport_to_id)
);

CREATE TABLE routes_flights (
	id integer PRIMARY KEY,
	route_id integer NOT NULL,
	flight_id integer NOT NULL,
	is_return integer NOT NULL DEFAULT 0,
	FOREIGN KEY (route_id) REFERENCES routes(id),
	FOREIGN KEY (flight_id) REFERENCES flights(id),
	UNIQUE(flight_id, route_id, is_return)
);
