import collections
import time

from ws.config import config
from ws.logs import error_log

RATE_LIMIT_EXIT_CODE_OFFSET = 200
CLIENT_ERRORS_THRESHOLD = config.getint('http', 'client_errors_threshold')
CONSIDERED_CLIENT_ERRORS = (400,)

ClientConnectionRecord = collections.namedtuple(
    'ClientRecord', ['address', 'recorded_on', 'err_count']
)


class RequestRateController:
    """ Implements rate limiting on a per ip address basis.

    For this class to function properly handled http connections must be
    registered through record_handled_connection() after workers have finished
    with them.

    Banned ip addresses can be checked through is_banned() method.
    """
    max_recorded_addresses = 10
    max_recorded_connections = 10
    client_errors_threshold = config.getint(
        'http', 'client_errors_threshold'
    )
    ban_duration = config.getint(
        'http', 'ban_duration'
    )
    required_records = client_errors_threshold * 2

    def __init__(self):
        self.connection_records = collections.defaultdict(self.deque_factory)

    def deque_factory(self):
        return collections.deque(maxlen=self.max_recorded_connections)

    def is_banned(self, ip_address):
        # cleanup record older than ban_duration because they cannot be used
        # to determine if an address should currently be banned.
        recent_records = self.deque_factory()

        for conn_record in self.connection_records[ip_address]:
            if time.time() - conn_record.recorded_on < self.ban_duration:
                recent_records.append(conn_record)

        self.connection_records[ip_address] = recent_records

        if len(self.connection_records[ip_address]) < self.required_records:
            error_log.debug("Address %s has only connected %s times."
                            "Cannot determine if he should be banned.",
                            ip_address,
                            len(self.connection_records[ip_address]))
            return False

        records = self.connection_records[ip_address]
        client_errors = sum(cr.err_count for cr in records)

        return client_errors >= self.client_errors_threshold

    def record_handled_connection(self, ip_address, worker_exit_code):
        assert isinstance(worker_exit_code, int), worker_exit_code

        error_log.info('Recording handled connection of %s. Worker exited '
                       'with code %s', ip_address, worker_exit_code)

        if worker_exit_code >= RATE_LIMIT_EXIT_CODE_OFFSET:
            err_count = RATE_LIMIT_EXIT_CODE_OFFSET - worker_exit_code
        else:
            err_count = 0

        cr = ClientConnectionRecord(
            address=ip_address,
            recorded_on=time.time(),
            err_count=err_count
        )

        if err_count:
            error_log.info('Error count of address %s increased by %s',
                           ip_address, err_count)

        if len(self.connection_records) <= self.max_recorded_addresses:
            self.connection_records[ip_address].append(cr)
        else:
            error_log.warning(
                "Reached max recorded addresses for rate limiting "
                "purposes."
            )
            target = next(a for a in self.connection_records if a != ip_address)
            del self.connection_records[target]
            self.connection_records[ip_address].append(cr)
