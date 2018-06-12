-- with user 'wordpress':
-- \. [path to file]\create_locations_table.sql
USE wordpress;
CREATE TABLE locations (
    id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
    address TEXT,
    elevation DECIMAL,
    elevation_unit TEXT,
    data_coverage DECIMAL,
    min_date DATE,
    max_date DATE,
    lat DECIMAL,
    lng DECIMAL
);
