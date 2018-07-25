CREATE TABLE cities (
  id integer primary key autoincrement,
  name text not null unique,
  country_code text,
  lng decimal,
  lat decimal,
  observed_at text
);

CREATE TABLE weather_conditions (
  id integer primary key autoincrement,
  city_id integer not null,
  weather text,
  weather_description text,
  cloudiness decimal,
  humidity decimal,
  max_temperature decimal,
  min_temperature decimal,
  sea_pressure decimal,
  ground_pressure decimal,
  wind_direction decimal,
  wind_speed decimal,
  forecast_time text not null,
  foreign key (city_id) references cities(id),
  unique (city_id, forecast_time) on conflict replace
);

CREATE TABLE api_keys (
  id integer primary key autoincrement,
  key text not null,
  user_id integer not null,
  use_count integer default 0,
  foreign key (user_id) references users(id)
);

CREATE TABLE users (
  id integer primary key autoincrement,
  username text not null,
  email text not null,
  password text not null,
  salt text not null,
  date_registered text not null,
  unique (username) on conflict ignore
);
