#!/usr/bin/env python3
import os
import sys

print("Environ is ", os.environ)

with open('/tmp/wat', mode='w') as f:
    f.write('Began execution.')

print("First 4096 bytes of body are: ", sys.stdin.read(4096))
print("Second 4096 bytes of body are: ", sys.stdin.read(4096))

sys.stdout.flush()
