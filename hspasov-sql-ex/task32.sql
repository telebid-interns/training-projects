-- Short database description "Ships"

-- One of the characteristics of a ship is one-half the cube of the calibre of its main guns (mw).
-- Determine the average ship mw with an accuracy of two decimal places for each country having ships in the database.

-- not working

SELECT country, AVG(0.5 * power(bore, 3)) AS weight
FROM Ships
JOIN Classes ON Ships.class = Classes.class
GROUP BY Classes.country;
