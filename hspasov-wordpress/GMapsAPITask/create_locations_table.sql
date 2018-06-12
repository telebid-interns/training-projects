-- with user 'wordpress':
-- \. [path to file]\create_locations_table.sql
USE wordpress;
CREATE TABLE locations (
    id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
    address TEXT NOT NULL,
    lat TEXT NOT NULL,
    lng TEXT NOT NULL
);