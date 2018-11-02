#!/usr/bin/python
import MySQLdb
import os
import requests
import stat
import sys
import re

class WordPressMonitor(object):
    MAINTAINED_VERSIONS = ['4.9.8']
    db_info = {}

    def __init__(self, wp_path):
        self.wp_path = wp_path
        self.check_version()
        self.init_db()

        self.option_expected_dict = {
            'users_can_register': '0',
            'default_comment_status': 'closed'
        }

        self.option_actual_dict = {}

    def check_version(self):
        """Reads the /wp-includes/version.php file and extracts the value of $wp_version

            Raises AssertionError when $wp_version is not found 
            in the file or is not contained in MAINTAINED_VERSIONS
            Returns None
        """
        content = self.read_whole_file(self.wp_path + '/wp-includes/version.php')
        pattern = re.compile("""\$wp_version\s*=\s*['"]([^'"]*?)['"];""")
        match = pattern.search(content)
        assert match, 'Could not find WP version in {}/wp-includes/version.php'.format(self.wp_path)
        wp_version = match.group(1)
        assert wp_version in self.MAINTAINED_VERSIONS, 'WP version ({}) is not maintained. Maintained versions are: {}'.format(wp_version, ', '.join(self.MAINTAINED_VERSIONS))

    def init_db(self):
        """Reads the /wp-config.php file, extracts the DB_NAME, DB_USER, DB_PASSWORD and DB_HOST
            values with a regex and saves them in dict 

            Raises AssertionError if the regex doesnt find all the values
            Returns None
        """
        content = self.read_whole_file(self.wp_path + '/wp-config.php')

        for word in ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST']:
            pattern = re.compile("""define\(["']{}["'],\s*["']([^'"]*?)[\"']\);""".format(word))
            match = pattern.search(content)
            assert match, 'Could not find {} in {}/wp-confing'.format(word, self.wp_path)
            self.db_info[word] = match.group(1)

        self.db = MySQLdb.connect(
            host=self.db_info['DB_HOST'],
            user=self.db_info['DB_USER'],
            passwd=self.db_info['DB_PASSWORD'],
            db=self.db_info['DB_NAME']
        )

        self.cur = self.db.cursor()

    def start_test(self):
        """Querries the WP database, extracts option_name column value from the wp_options table
            and asserts the expected values with the actual

            If assertion succeeds '1' is printed on stdout
            If assertion fails '0' is printed on stdout and differences are printed on stderr

            Returns None
        """
        for option in self.option_expected_dict:
            rows = self.execute_sql("SELECT option_value FROM wp_options WHERE option_name = %s", [option])
            self.option_actual_dict[option] = rows[0][0]

        for option in self.option_expected_dict:
            if self.option_actual_dict[option] != self.option_expected_dict[option]:
                self.fail()
                sys.stdout.write('0')
                return

        sys.stdout.write('1')

        self.db.close()

    def execute_sql(self, sql, *args):
        try:
            self.cur.execute(sql, args)
            return self.cur.fetchall()
        except Exception as e:
            assert False, 'Could not execute query {} with params {}'.format(sql, args)

    def read_whole_file(self, path):
        try:
            with open(path, "r") as file:
                return file.read()
        except OSError as e:
            assert False, 'Could not read file {}'.format(path)

    def fail(self):
        """Prints differences on stderr"""
        sys.stderr.write('Expected:\n')
        for option in self.option_expected_dict:
            if self.option_expected_dict[option] != self.option_actual_dict[option]:
                sys.stderr.write('{}: {}\n'.format(option, self.option_expected_dict[option]))

        sys.stderr.write('\n')

        sys.stderr.write('Actual:\n')
        for option in self.option_actual_dict:
            if self.option_expected_dict[option] != self.option_actual_dict[option]:
                sys.stderr.write('{}: {}\n'.format(option, self.option_actual_dict[option]))

if __name__ == '__main__':
    assert len(sys.argv) > 1, 'WordPress path required as first parameter'
    WordPressMonitor(sys.argv[1]).start_test()
