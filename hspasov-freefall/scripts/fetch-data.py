import urllib.request
import json
import sqlite3

class BaseError(Exception):
	def __init__(self, msg):
		super().__init__(msg)
		print(msg)

class AppError(BaseError):
	def __init__(self, msg):
		super().__init__(msg)
		print(self.msg)
		print('inside app error')

class PeerError(BaseError):
	def __init__(self, msg):
		self.msg = msg

class UserError(BaseError):
	def __init__(self, msg):
		self.msg = msg

def assertApp(condition, msg):
	if not condition:
		raise AppError(msg)

def assertPeer(condition, msg):
	if not condition:
		raise PeerError(msg)

def assertUser(condition, msg):
	if not condition:
		raise UserError(msg)


conn = sqlite3.connect('../freefall.db')
c = conn.cursor()
c.execute('SELECT * FROM airports;')
print(c.fetchall())

contents = urllib.request.urlopen("https://api.skypicker.com/airlines").read()
parsed_airlines = json.loads(contents.decode('utf-8'))
print(parsed_airlines[0]['id'])

assertApp(False, 'it works')