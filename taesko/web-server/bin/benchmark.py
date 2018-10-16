#!/usr/bin/env python3
import argparse
import collections
import enum
import re
import subprocess
import os
import json

import sys

import openpyxl
import openpyxl.utils


DEFAULT_COLUMN_WIDTH = 25


ABResult = collections.namedtuple('ABResult', ['commit', 'fields', 'raw'])
ABField = collections.namedtuple('ABField', ['field_text', 'value_text',
                                             'name', 'value'])


class TimeValue(collections.namedtuple('TimeValue', ['raw', 'unit'])):
    def __str__(self):
        return str(self.raw)


class ABOutTypes(enum.Enum):
    default = 'default'


def parse_ttt(text, value):
    """ Time taken for tests."""
    value_re = re.compile(r'([\d.]+) seconds')
    match = value_re.match(value)

    assert match

    return ABField(field_text=text, value_text=value,
                   name='ttt', value=TimeValue(raw=float(match.group(1)),
                                               unit='seconds'))


def parse_rps(text, value):
    """ Requests per second."""
    return parse_default_number(text, value)


def parse_tpr(text, value):
    """ Time per request."""
    match = re.match(r'([\d.]+)', value)

    assert match

    return ABField(field_text=text, value_text=value,
                   name='tpr', value=TimeValue(raw=float(match.group(1)),
                                               unit='milliseconds'))


def parse_default_number(text, value):
    match = re.match(r'([\d.]+)', value)

    assert match

    return ABField(field_text=text, value_text=value,
                   name=text, value=float(match.group(1)))


def parse_default(text, value):
    return ABField(field_text=text, value_text=value,
                   name=text, value=value)


AB_FIELD_PARSERS = collections.OrderedDict(
    (
        ('Document Path', parse_default),
        ('Concurrency Level', parse_default_number),
        ('Complete requests', parse_default_number),
        ('Failed requests', parse_default_number),
        ('Requests per second', parse_rps),
        ('Time per request', parse_tpr),
        ('Time taken for tests', parse_ttt)
    )
)


def parse_ab_out(out, type_=ABOutTypes.default):
    field_regex = re.compile(r'\s*(.+?)\s*:\s*(.*)\s*')
    fields = {}

    for i, line in enumerate(out.splitlines()):
        line = line.strip()
        if i < 7 or not line:
            continue

        match = field_regex.match(line)

        if not match:
            continue

        fields[match.group(1).strip()] = match.group(2).strip()

    return [func(field, fields[field])
            for field, func in AB_FIELD_PARSERS.items()]


def run_test(ab_args):
    ab_args = tuple(str(a) for a in ab_args)
    print('Running AB with arguments: `{}`'
          .format(' '.join(ab_args)))
    out = subprocess.check_output(ab_args).decode('utf-8')
    fields = {f.name: f for f in parse_ab_out(out)}
    git_out = subprocess.check_output(['git', 'log', '--oneline'],
                                      universal_newlines=True)
    commit = git_out.splitlines()[0]
    return ABResult(commit=commit, fields=fields, raw=out)


def run_tests(host, port, *, request_numbers, concurrences, static_route,
              benchmarks_dir, protocol='http'):
    os.makedirs(benchmarks_dir, exist_ok=True)
    if static_route.startswith('/'):
        static_route = static_route[1:]

    results = []
    for n, c in zip(request_numbers, concurrences):
        url = '{}://{}:{}/{}'.format(protocol, host, port, static_route)
        ab_args = ['ab', '-n', n, '-c', c, url]
        ab_result = run_test(ab_args)

        test_name = "GET_{}_{}_{}".format(
            static_route.replace('/', percent_encode('/')),
            n,
            c
        )
        raw_file_name = os.path.join(
            benchmarks_dir, test_name + '.raw'
        )
        with open(raw_file_name, mode='w') as f:
            f.write(ab_result.raw)

        json_file_name = os.path.join(benchmarks_dir, test_name + '.json')
        with open(json_file_name, mode='w') as f:
            json.dump(ab_result_to_dict(ab_result), f)

        results.append(ab_result)

    xlsx_file_name = os.path.join(
        benchmarks_dir,
        "GET_{}.xlsx".format(static_route).replace('/', percent_encode('/'))
    )
    dump_ab_result_to_xlsx(
        results,
        xlsx_file_name
    )


def dump_ab_result_to_xlsx(ab_results, file_path):
    assert len(set(ar.fields['Document Path'] for ar in ab_results)) == 1

    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.title = 'Benchmarks.'
    row, col = (1, 1)
    table = []
    column_names = tuple(AB_FIELD_PARSERS.keys())

    for ab_result in ab_results:
        ab_fields = ab_result.fields.values()
        ab_fields = sorted(
            ab_fields,
            key=lambda field: column_names.index(field.field_text)
        )
        table.append(tuple(f.value for f in ab_fields))

    insert_table(sheet, (row, col), tuple(table), column_names=column_names)

    for i in range(1, len(column_names) + 1):
        letter = openpyxl.utils.get_column_letter(i)
        sheet.column_dimensions[letter].width = DEFAULT_COLUMN_WIDTH

    wb.save(file_path)

    return


def insert_table(sheet, position, table, *, column_names=None, table_name=None):
    if not table:
        return 0, 0

    row, col = position
    if table_name:
        r, _ = insert_row(sheet, (row, col), [table_name])
        row += r
    if column_names:
        r, _ = insert_row(sheet, (row, col), column_names)
        row += r
    for row_values in table:
        r, _ = insert_row(sheet, (row, col), row_values)
        row += r

    return len(table), len(table[0])


def insert_row(sheet, position, values):
    row, col = position
    i = None

    for i, v in enumerate(values):
        sheet.cell(row=row, column=col + i, value=str(v))

    if i:
        return 1, i + 1
    else:
        return 0, 0


def ab_result_to_dict(ab_result):
    dct = namedtuple_to_dict(ab_result)
    dct['fields'] = {k: namedtuple_to_dict(v)
                     for k, v in dct['fields'].items()}
    return dct


def namedtuple_to_dict(nt):
    # noinspection PyProtectedMember
    dct = nt._asdict()

    for key, value in dct.items():
        if hasattr(value, '_asdict'):
            dct[key] = namedtuple_to_dict(value)

    return dct


def percent_encode(char):
    return '%' + hex(ord(char))[2:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        'concurrences',
        help='Space separated list of concurrences to benchmark',
        nargs='+',
        type=int
    )
    parser.add_argument('--host', help='Host name of server.',
                        default='localhost')
    parser.add_argument('-p', '--port', help='Port of server.',
                        default='5678', type=int)
    parser.add_argument('-r', help='Route to benchmark', required=True)
    parser.add_argument('-n', help='Number of total requests', default=20)
    parser.add_argument('-d', '--directory', default='tests/benchmarks/',
                        help='Output directory for results.')
    args = parser.parse_args()

    if not os.path.exists(args.directory):
        os.makedirs(args.directory)
    elif not os.path.isdir(args.directory):
        print('{} is not a directory'.format(args.directory))
        sys.exit(1)

    request_numbers = [args.n] * len(args.concurrences)
    run_tests(args.host, args.port,
              request_numbers=request_numbers,
              concurrences=args.concurrences,
              static_route=args.r,
              benchmarks_dir=args.directory)


if __name__ == '__main__':
    main()
