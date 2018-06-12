#!/usr/bin/python
import resource
import os
import time
import datetime

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
        i = i + 1
        line = p.readline()
        if i==2:
            return(line.split()[1:5])

def getTotalRequestsForToday():
    requests = 0
    today = datetime.date.today()
    path = './logs/%s.txt' % today
    if os.path.exists(path):
        try:
            log = open(path, 'r')
            for line in log:
                words = line.split()
                for word in words:
                    if(word=='localhost:8888' or word=='127.0.0.1:8888'):
                        requests=requests+1
        except Exception as e:
            print e
        finally:
            log.close()
    else:
        return 0

    return requests

def getInfo():
    report = ''
    report += 'TOTAL RAM: %s' % getRAMinfo()[0] + ' KB\n'
    report += 'USED RAM: %s' % getRAMinfo()[1] + ' KB\n'
    report += 'FREE RAM: %s' % getRAMinfo()[2] + ' KB\n'

    report += 'CPU USAGE: %s' % getCPUuse() + '%\n'

    report += 'TOTAL DISK SPACE: %s' % getDiskSpace()[0] + 'B\n'
    report += 'USED DISK SPACE: ' + getDiskSpace()[1] + 'B' + ' (' + getDiskSpace()[3] + ')\n'
    report += 'FREE DISK SPACE: %s' % getDiskSpace()[2] + 'B\n'

    report += 'REQUESTS MADE TODAY: %s' % getTotalRequestsForToday()
    return report

while True:
    try:
        report = getInfo()
        file = open("./monitoring/parameters.txt","w")
        file.write(report)
    except Exception as e:
        print 'Error while logging: \n'
        print e
    finally:
        file.close()
        time.sleep(1)
