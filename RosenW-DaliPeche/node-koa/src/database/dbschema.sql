CREATE TABLE reports ( --bad name
  id integer primary key autoincrement,
  city text,
  country_code text,
  lng decimal,
  lat decimal,
  observed_at text
);

CREATE UNIQUE INDEX citynameindex on reports(city);

CREATE TABLE weather_conditions (
  id integer primary key autoincrement,
  report_id integer,
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
  date text, -- TODO change name
  foreign key (report_id) references reports(id),
  unique (report_id, date) on conflict replace
);

CREATE TABLE apikeys ( -- TODO change name api_keys
  id integer primary key autoincrement,
  key text,
  account_id integer,
  foreign key (account_id) references accounts(id)
);

CREATE TABLE accounts (
  id integer primary key autoincrement,
  username text,
  password text,
  salt text,
  request_count integer,
  date_registered text,
  unique (username) on conflict ignore
);
