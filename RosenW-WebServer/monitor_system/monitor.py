import sys
import os
import time
import traceback

class Monitor(object):
    """Monitors a given process and its children"""
    def __init__(self, pid):
        self.pid = pid

    def start(self):
        while True:
            try:
                self.log('Monitoring process: {}'.format(self.pid))
                dirs = next(os.walk('/proc'))[1];
                child_processes = []
                main_process = None
                for d in dirs:
                    if d.isdigit():
                        try:
                            with open('/proc/{}/stat'.format(d), 'r') as file:
                                content = file.read()
                                if content.split()[3] == self.pid: # [3] is PPID
                                    child_processes.append(content.split())
                                elif content.split()[0] == self.pid: # [0] is PID
                                    main_process = content.split()
                        except FileNotFoundError as e:
                            pass

                self.log('-----------------------')
                self.log('Main Process:')
                self.log('PID: {}'.format(self.pid))
                self.log('  RSS Memory used: {}'.format(main_process[23]))

                self.log('Child Processes ({}):'.format(len(child_processes)))

                for proc in child_processes:
                    self.log('  -----------------------')
                    self.log('  PID: {}'.format(proc[0]))
                    self.log('  RSS Memory used: {}'.format(proc[23]))

                time.sleep(1)
            except Exception as e:
                traceback.print_exc()
            except KeyboardInterrupt as e:
                self.log('Stopping...')
                sys.exit()

    def log(self, msg):
        try:
            print(msg)
        except Exception as e:
            pass

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        Monitor(sys.argv[1]).start()
    else:
        print('Please provide PID')
