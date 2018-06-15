import collections
import os
import xlrd


Municipation = collections.namedtuple('Municipation', ['str_id', 'name', 'central_ekatte'])
Province = collections.namedtuple('Province', ['str_id', 'municipation_id', 'name', 'central_ekatte'])
Ekatte = collections.namedtuple('Ekatte', ['str_id', 'province_id', 'name', 'type', 'altitude'])


def xls_files():
    dpath = 'xls_data'
    paths = {'ekatte': 'Ek_atte.xls',
             'provinces': 'Ek_obst.xls',
             'municipations': 'Ek_obl.xls'}
    for key, path in paths.items():
        yield key, os.path.join(dpath, path)


def xls_parser(func):
    def wrapped(file):
        print("Parsing file", file)
        book = xlrd.open_workbook(file)
        print("The number of worksheets is {0}".format(book.nsheets))
        print("Worksheet name(s): {0}".format(book.sheet_names()))
        sh = book.sheet_by_index(0)
        print("Parsing only first sheet -", sh)
        return func(sh)
    return wrapped


def province_from(row):
    str_id, municipation_id = row[0].value[:3], row[0].value[3:]
    name = row[2].value
    return Province(str_id, municipation_id, name)


@xls_parser
def parse_provinces(sheet):
    for rx in range(1, sheet.nrows): # first row contains column names
        yield province_from(sheet.row(rx))


@xls_parser
def parse_municipations(sheet):
    pass

def parse_data():
    files = dict(xls_files())
    import pprint
    pprint.pprint(list(parse_provinces(files['provinces'])))


parse_data()

