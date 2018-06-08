#!/usr/bin/python
import resource
import os
import time

# Return RAM information (unit=kb) in a list
# Index 0: total RAM
# Index 1: used RAM
# Index 2: free RAM
def getRAMinfo():
    p = os.popen('free')
    i = 0
    while 1:
        i = i + 1
        line = p.readline()
        if i==2:
            return(line.split()[1:4])

# Return % of CPU used by user as a character string
def getCPUuse():
    return(str(os.popen("top -n1 | awk '/Cpu\(s\):/ {print $2}'").readline().strip(\
)))

# Return information about disk space as a list (unit included)
# Index 0: total disk space
# Index 1: used disk space
# Index 2: remaining disk space
# Index 3: percentage of disk used
def getDiskSpace():
    p = os.popen("df -h /")
    i = 0
    while 1:
        i = i +1
        line = p.readline()
        if i==2:
            return(line.split()[1:5])

while True:
    try:
        report = ''
        report += 'TOTAL RAM: %s\n' % getRAMinfo()[0]
        report += 'USED RAM: %s\n' % getRAMinfo()[1]
        report += 'FREE RAM: %s\n' % getRAMinfo()[2]

        report += 'CPU USAGE: %s' % getCPUuse() + '%\n'

        report += 'TOTAL DISK SPACE: %s\n' % getDiskSpace()[0]
        report += 'USED DISK SPACE: ' + getDiskSpace()[1] + ' (' + getDiskSpace()[3] + ')\n'
        report += 'FREE DISK SPACE: %s\n' % getDiskSpace()[2]

        file = open("./monitoring/parameters.txt","w")
        file.write(report)
    except Exception as e:
        print 'Error while logging: \n'
        print e
    finally:
        file.close()
        time.sleep(1)
