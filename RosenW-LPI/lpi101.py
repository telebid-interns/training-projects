#!/bin/sh
import time
import os

file = open("/var/run/myserv/myserv.pid", "w+")
file.write(os.getpid())
file.close()

while True:
	print("Time to write !")
	time.sleep(3600)