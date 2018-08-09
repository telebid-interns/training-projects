CREATE TABLE requests (
  id serial PRIMARY KEY,
  iata_code text, -- not null for both
  city text,
  call_count integer DEFAULT 1 NOT NULL
);

CREATE TABLE cities (
  id serial PRIMARY KEY,
  name text NOT NULL unique,
  country_code text,
  lng numeric,
  lat numeric,
  observed_at timestamp
);

CREATE TABLE weather_conditions (
  id serial PRIMARY KEY,
  city_id integer NOT NULL REFERENCES cities(id),
  weather text,
  weather_description text,
  cloudiness numeric,
  humidity numeric,
  max_temperature numeric,
  min_temperature numeric,
  sea_pressure numeric,
  ground_pressure numeric,
  wind_direction numeric,
  wind_speed numeric,
  forecast_time timestamp NOT NULL,
  unique (city_id, forecast_time)
);

CREATE TABLE users (
  id serial PRIMARY KEY,
  username text NOT NULL unique,
  email text NOT NULL,
  credits numeric DEFAULT 0 NOT NULL,
  failed_requests integer DEFAULT 0 NOT NULL,
  successful_requests integer DEFAULT 0 NOT NULL,
  password text NOT NULL,
  salt text NOT NULL,
  date_registered timestamp NOT NULL
);

CREATE TABLE api_keys (
  id serial PRIMARY KEY,
  key text NOT NULL,
  user_id integer NOT NULL REFERENCES users(id),
  use_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE credit_transfers (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  credits_bought numeric, -- not null for both
  credits_spent numeric,
  event text NOT NULL,
  transfer_date timestamp NOT NULL
);