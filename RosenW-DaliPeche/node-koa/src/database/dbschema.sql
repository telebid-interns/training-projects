CREATE TABLE cities (
  id serial primary key,
  name text not null unique,
  country_code text,
  lng numeric,
  lat numeric,
  observed_at date
);

CREATE TABLE weather_conditions (
  id serial primary key,
  city_id integer not null,
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
  forecast_time text not null,
  foreign key (city_id) references cities(id),
  unique (city_id, forecast_time)
);

CREATE TABLE users (
  id serial primary key,
  username text not null,
  email text not null,
  password text not null,
  salt text not null,
  date_registered text not null,
  unique (username)
);

CREATE TABLE api_keys (
  id serial primary key,
  key text not null,
  user_id integer not null,
  use_count integer default 0,
  foreign key (user_id) references users(id)
);
