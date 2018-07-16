CREATE TABLE reports (
id integer primary key autoincrement,
city text,
country_code text,
lng decimal,
lat decimal,
observed_at date);

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
date text,
foreign key (report_id) references reports(id),
unique (report_id, date) on conflict replace);

CREATE TABLE apikeys (
id integer primary key autoincrement,
key text,
use_count integer
);