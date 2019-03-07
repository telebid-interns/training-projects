-- Short database description "Ships"

-- Find classes for which only one ship exists in the database (including the Outcomes table).

-- not working

SELECT Ships.class
FROM Ships
GROUP BY Ships.class
HAVING Count(Ships.name) = 1
UNION
SELECT Classes.class
FROM Outcomes
JOIN Classes ON Outcomes.ship = Classes.class
AND Classes.class NOT IN (
SELECT Ships.class
FROM Ships
);
