-- Short database description "Ships"

-- Find the names of the ships having a gun caliber of 16 inches (including ships in the Outcomes table).

-- not working

SELECT Ships.name
FROM Classes
JOIN Ships ON Classes.class = Ships.class
WHERE Classes.bore = 16
UNION
SELECT Outcomes.Ship
FROM Outcomes
FULL OUTER JOIN Ships ON Outcomes.Ship = Ships.name 
WHERE Ships.name IS NULL AND Outcomes.ship IS NOT NULL;
