SELECT fetches.timestamp, afrom.iata_code, afrom.name, ato.iata_code, ato.name FROM fetches
LEFT JOIN subscriptions ON fetches.subscription_id = subscriptions.id
LEFT JOIN airports AS afrom ON afrom.id = subscriptions.airport_from_id
LEFT JOIN airports AS ato ON ato.id = subscriptions.airport_to_id
WHERE subscriptions.airport_from_id = 2 AND subscriptions.airport_to_id = 3
GROUP BY afrom.iata_code, afrom.name, ato.iata_code, ato.name
HAVING MAX(fetches.timestamp);



SELECT id, booking_token, price FROM routes WHERE fetch_id = ?;

and for each route:

SELECT airlines.name, airlines.logo_url, afrom.name, ato.name, flights.dtime, flights.atime, flights.flight_number, routes_flights.is_return FROM routes_flights
LEFT JOIN flights ON routes_flights.flight_id = flights.id
LEFT JOIN airports as afrom ON afrom.id = flights.airport_from_id
LEFT JOIN airports as ato ON ato.id = flights.airport_to_id
LEFT JOIN airlines ON airlines.id = flights.airline_id
WHERE routes_flights.route_id = 500;