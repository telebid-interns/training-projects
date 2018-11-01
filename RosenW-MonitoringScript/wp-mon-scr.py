#!/usr/bin/python
import MySQLdb
import os
import requests
import stat

db = MySQLdb.connect(
	host="localhost",
    user="rosen",
    passwd="1234",
    db="wpdb"
)

cur = db.cursor()

cur.execute("SELECT * FROM wp_options WHERE option_name = 'users_can_register'")
print('Registration allowed value: {}'.format(cur.fetchall()[0][2]))

cur.execute("SELECT * FROM wp_options WHERE option_name = 'default_comment_status'")
print('Comments allowed value: {}'.format(cur.fetchall()[0][2]))

cur.execute("SELECT COUNT(*) FROM wp_users")
print('User count: {}'.format(cur.fetchall()[0][0]))

print('Is Admin Panel Page wp-admin: {}'.format('wp-admin' in next(os.walk('/var/www/html'))[1]))

req = requests.get('http://localhost/wp-admin')
print('Can /wp-admin be accessed: {}'.format(req.status_code == 200))

permissions = []

for root, dirs, files in os.walk('/var/www/html'):
	for dir in dirs:
		permissions.append(stat.filemode(os.stat(str(root) + '/' + str(dir)).st_mode))
	for file in files:
		permissions.append(stat.filemode(os.stat(str(root) + '/' + str(file)).st_mode))

print('File and folder permissions: {}'.format(permissions[:10]))

db.close()