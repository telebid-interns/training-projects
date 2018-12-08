from datetime import datetime, timedelta
from config import CONFIG


class ClientConnectionMonit:
    def __init__(self):
        self.start_time = datetime.now()
        self.receive_meta_begin = None
        self.receive_meta_end = None
        self.serve_static_begin = None
        self.serve_static_end = None
        self.serve_cgi_begin = None
        self.serve_cgi_end = None
        self.send_meta_begin = None
        self.send_meta_end = None
        self.end_time = None

    def mark_receive_meta_begin(self):
        self.receive_meta_begin = datetime.now()

    def mark_receive_meta_end(self):
        self.receive_meta_end = datetime.now()

    def mark_serve_static_begin(self):
        self.serve_static_begin = datetime.now()

    def mark_serve_static_end(self):
        self.serve_static_end = datetime.now()

    def mark_serve_cgi_begin(self):
        self.serve_cgi_begin = datetime.now()

    def mark_serve_cgi_end(self):
        self.serve_cgi_end = datetime.now()

    def mark_send_meta_begin(self):
        self.send_meta_begin = datetime.now()

    def mark_send_meta_end(self):
        self.send_meta_end = datetime.now()

    def mark_end(self):
        self.end_time = datetime.now()


class Profiler:
    def __init__(self):
        self._client_conn_monits = []

    def add_monit(self, monit):
        assert len(self._client_conn_monits) < CONFIG['max_monits']

        self._client_conn_monits.append(monit)

    def get_monits_count(self):
        return len(self._client_conn_monits)

    def get_averages(self):
        if len(self._client_conn_monits) == 0:
            return None

        sum_connection_durations = timedelta(0)
        sum_receive_meta_durations = timedelta(0)
        sum_serve_static_durations = timedelta(0)
        sum_serve_cgi_durations = timedelta(0)
        sum_send_meta_durations = timedelta(0)

        receive_meta_monits_count = 0
        serve_static_monits_count = 0
        serve_cgi_monits_count = 0
        send_meta_monits_count = 0

        for monit in self._client_conn_monits:
            assert isinstance(monit.start_time, datetime)
            assert isinstance(monit.end_time, datetime)

            sum_connection_durations += monit.end_time - monit.start_time

            if isinstance(monit.receive_meta_begin, datetime):
                assert isinstance(monit.receive_meta_end, datetime)

                sum_receive_meta_durations += monit.receive_meta_end - monit.receive_meta_begin
                receive_meta_monits_count += 1

            if isinstance(monit.serve_static_begin, datetime):
                assert isinstance(monit.serve_static_end, datetime)

                sum_serve_static_durations += monit.serve_static_end - monit.serve_static_begin
                serve_static_monits_count += 1

            if isinstance(monit.serve_cgi_begin, datetime):
                assert isinstance(monit.serve_cgi_end, datetime)

                sum_serve_cgi_durations += monit.serve_cgi_end - monit.serve_cgi_begin
                serve_cgi_monits_count += 1

            if isinstance(monit.send_meta_begin, datetime):
                assert isinstance(monit.send_meta_end, datetime)

                sum_send_meta_durations += monit.send_meta_end - monit.send_meta_begin
                send_meta_monits_count += 1

        averages = {}

        avr_connection_duration = sum_connection_durations / len(self._client_conn_monits)
        averages['connection'] = avr_connection_duration.microseconds

        if receive_meta_monits_count > 0:
            avr_receive_meta_duration = sum_receive_meta_durations / receive_meta_monits_count
            averages['receive_meta'] = avr_receive_meta_duration.microseconds
        if serve_static_monits_count > 0:
            avr_serve_static_duration = sum_serve_static_durations / serve_static_monits_count
            averages['serve_static'] = avr_serve_static_duration.microseconds
        if serve_cgi_monits_count > 0:
            avr_serve_cgi_duration = sum_serve_cgi_durations / serve_cgi_monits_count
            averages['serve_cgi'] = avr_serve_cgi_duration.microseconds
        if send_meta_monits_count > 0:
            avr_send_meta_duration = sum_send_meta_durations / send_meta_monits_count
            averages['send_meta'] = avr_send_meta_duration.microseconds

        return averages
