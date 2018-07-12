import urllib.request
import json
import sqlite3

conn = sqlite3.connect('../freefall.db')
c = conn.cursor()
c.execute('SELECT * FROM airports;')
print(c.fetchall())

contents = urllib.request.urlopen("https://api.skypicker.com/airlines").read()
parsed_airlines = json.loads(contents.decode('utf-8'))
print(parsed_airlines[0]['id'])