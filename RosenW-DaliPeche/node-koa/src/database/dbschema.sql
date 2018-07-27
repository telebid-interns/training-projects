CREATE TABLE cities (
  id serial PRIMARY KEY,
  name text NOT NULL unique,
  country_code text,
  lng numeric,
  lat numeric,
  observed_at date
);

CREATE TABLE weather_conditions (
  id serial PRIMARY KEY,
  city_id integer NOT NULL,
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
  forecast_time text NOT NULL,
  FOREIGN KEY (city_id) REFERENCES cities(id),
  unique (city_id, forecast_time)
);

CREATE TABLE users (
  id serial PRIMARY KEY,
  username text NOT NULL,
  email text NOT NULL,
  credits numeric DEFAULT 0 NOT NULL,
  failed_requests integer DEFAULT 0 NOT NULL,
  successful_requests integer DEFAULT 0 NOT NULL,
  password text NOT NULL,
  salt text NOT NULL,
  date_registered text NOT NULL,
  unique (username)
);

CREATE TABLE api_keys (
  id serial PRIMARY KEY,
  key text NOT NULL,
  user_id integer NOT NULL,
  use_count integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE requests (
  id serial PRIMARY KEY,
  iata_code text,
  city text,
  call_count integer DEFAULT 1 NOT NULL
);
