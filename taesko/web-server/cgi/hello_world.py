#!/usr/bin/env python3
import os
import sys
import time

print("Environ is ", os.environ)

while True:
    print('Reading')
    print('Read: ', sys.stdin.read(5))
    print('Finished')
    time.sleep(2)
