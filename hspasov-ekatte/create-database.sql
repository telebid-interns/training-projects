-- $ sudo su - postgres
-- $ psql
-- connect to database 'postgres' with user 'postgres'. Query:
-- DROP DATABASE IF EXISTS ekatte;
-- DROP USER IF EXISTS ekatte;
-- CREATE USER ekatte WITH ENCRYPTED PASSWORD 'ekatte';
-- CREATE DATABASE ekatte WITH OWNER ekatte;
--
--  connect user 'ekatte' to database 'ekatte':
-- $ \q
-- $ psql --username=ekatte --password
-- \i create-database.sql

CREATE TABLE ekattes (
  id TEXT NOT NULL PRIMARY KEY,
  kind INTEGER NOT NULL,
  name TEXT NOT NULL,
  province_id TEXT, -- can be null if record is a province
  municipality_id TEXT, -- can be null if record is a municipality
  municipal_gov_id TEXT NOT NULL, -- if new table 'municipal_governemts' is created, NOT NULL constraint should be removed
  category INTEGER NOT NULL,
  altitude_code INTEGER NOT NULL,
  tsb TEXT NOT NULL, -- if new table 'tsbs' is created, NOT NULL should be removed
  document TEXT NOT NULL -- if new table 'documents' is created, NOT NULL should be removed
);

CREATE TABLE municipalities (
  id TEXT NOT NULL PRIMARY KEY,
  ekatte_id TEXT NOT NULL,
  category INTEGER NOT NULL,
  document TEXT NOT NULL,
  FOREIGN KEY (ekatte_id) REFERENCES ekattes (id)
);

CREATE TABLE provinces (
  id TEXT NOT NULL PRIMARY KEY,
  ekatte_id TEXT NOT NULL,
  region TEXT NOT NULL,
  document TEXT NOT NULL,
  FOREIGN KEY (ekatte_id) REFERENCES ekattes (id)
);

ALTER TABLE ekattes
ADD FOREIGN KEY (province_id) REFERENCES provinces (id),
ADD FOREIGN KEY (municipality_id) REFERENCES municipalities (id);