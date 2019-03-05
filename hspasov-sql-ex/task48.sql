-- Short database description "Ships"

-- Find the ship classes having at least one ship sunk in battles.

-- not working

SELECT Ships.class
FROM Outcomes
JOIN Ships ON Ships.name = Outcomes.ship
WHERE Outcomes.result = 'sunk'
GROUP BY Ships.class;
