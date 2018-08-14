CREATE DOMAIN email AS text CHECK ( value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$' );

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
  email email NOT NULL,
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
  credits_received numeric,
  credits_spent numeric,
  event text NOT NULL,
  transfer_date timestamp NOT NULL,
  approved boolean DEFAULT true NOT NULL
);

CREATE INDEX requests_iata_code_index ON requests (iata_code);
CREATE INDEX requests_city_index ON requests (city);
CREATE INDEX requests_call_count_index ON requests (call_count);

CREATE INDEX cities_name_index ON cities (name);
CREATE INDEX cities_country_code_index ON cities (country_code);
CREATE INDEX cities_lng_index ON cities (lng);
CREATE INDEX cities_lat_index ON cities (lat);
CREATE INDEX cities_observed_at_index ON cities (observed_at);

CREATE INDEX weather_conditions_city_id_index ON weather_conditions (city_id);
CREATE INDEX weather_conditions_weather_index ON weather_conditions (weather);
CREATE INDEX weather_conditions_forecast_time_index ON weather_conditions (forecast_time);

CREATE INDEX users_username_index ON users (username);
CREATE INDEX users_email_index ON users (email);
CREATE INDEX users_credits_index ON users (credits);
CREATE INDEX users_failed_requests_index ON users (failed_requests);
CREATE INDEX users_successful_requests_index ON users (successful_requests);
CREATE INDEX users_password_index ON users (password);
CREATE INDEX users_salt_index ON users (salt);
CREATE INDEX users_date_registered_index ON users (date_registered);

CREATE INDEX api_keys_key_index ON api_keys (key);
CREATE INDEX api_keys_user_id_index ON api_keys (user_id);
CREATE INDEX api_keys_use_count_index ON api_keys (use_count);

CREATE INDEX credit_transfers_user_id_index ON credit_transfers (user_id);
CREATE INDEX credit_transfers_credits_bought_index ON credit_transfers (credits_bought);
CREATE INDEX credit_transfers_credits_spent_index ON credit_transfers (credits_spent);
CREATE INDEX credit_transfers_event_index ON credit_transfers (event);
CREATE INDEX credit_transfers_transfer_date_index ON credit_transfers (transfer_date);
