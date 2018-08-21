import argparse
import collections
import sys
import pprint

Location = collections.namedtuple('Location', ['row', 'col'])


class SquareMap(collections.UserDict):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._side_len = None
        self._mini_square_len = None

    @property
    def side_len(self):
        assert self._side_len
        return self._side_len

    @side_len.setter
    def side_len(self, value):
        assert isinstance(value, int)
        self._side_len = value

    @property
    def mini_square_len(self):
        return self._mini_square_len

    @mini_square_len.setter
    def mini_square_len(self, value):
        assert isinstance(value, int)
        self._mini_square_len = value


def construct_square_map(mini_square_len, symbols):
    dct = SquareMap()
    length = mini_square_len * mini_square_len
    dct.side_len = length
    dct.mini_square_len = mini_square_len

    for row in range(length):
        for col in range(length):
            dct[Location(row, col)] = set(symbols)

    return dct


def insert_symbol(square_map, location, symbol):
    return remove_symbol_from_locations(
        square_map,
        locations_affected_by_location(square_map, location),
        symbol
    )


def remove_symbol_from_locations(square_map, locations, symbol):
    modified = False
    for loc in locations:
        allowed = square_map[loc]

        assert len(allowed) > 0, 'got {allowed}'.format(**locals())
        assert len(allowed) > 1 or symbol not in allowed, '{symbol} is alone in {allowed}'.format(**locals())

        try:
            allowed.remove(symbol)
            modified = True
        except KeyError:
            pass

    return modified


def locations_affected_by_location(square_map, location):
    affected_rows = [Location(row, location.col) for row in range(square_map.side_len)]
    affected_cols = [Location(location.row, col) for col in range(square_map.side_len)]
    affected_square = []
    mini_square_len = square_map.mini_square_len
    square_row = mini_square_len * (location.row // mini_square_len)
    square_col = mini_square_len * (location.col // mini_square_len)
    for row in range(square_row, square_row+mini_square_len):
        for col in range(square_col, square_col+mini_square_len):
            affected_square.append(Location(row, col))

    affected = set(affected_rows + affected_cols + affected_square)
    affected.remove(location)
    return affected


def solve(square_map):
    print('Solving...')
    while True:
        modified_any = False
        finished = True
        for location, symbols in square_map.items():
            if len(symbols) == 1:
                symbol = next(iter(symbols))
                affected = locations_affected_by_location(square_map, location)
                modified = remove_symbol_from_locations(square_map, affected, symbol)
                modified_any = modified_any or modified
            else:
                finished = False
        if finished:
            return square_map
        else:
            assert modified_any, 'Unsolvable puzzle by algorithm'


def parse_input_file(file):
    with open(file, mode='r', encoding='ascii') as f:
        text = f.read()

    lines = iter(text.splitlines(keepends=False))
    try:
        mini_square_length = int(next(lines))
    except TypeError:
        print('Invalid input file. Expected integer on the first line for number of symbols')
        sys.exit(1)
    if not (2 <= mini_square_length <= 3):
        print('Expected number of symbols to be either 2 or 3')
        sys.exit(2)

    symbol_loc_map = {}

    for row, line in enumerate(lines):
        print(line)
        symbols = [s for s in line.split() if s]
        for col, sym in enumerate(symbols):
            if sym == '0':
                continue
            symbol_loc_map[Location(row, col)] = sym

    all_symbols = set(symbol_loc_map.values())
    square_map = construct_square_map(mini_square_length, all_symbols)

    for loc, symbol in symbol_loc_map.items():
        insert_symbol(square_map, loc, symbol)

    print_square_map(square_map)
    return square_map


def print_square_map(square_map):
    for row in range(square_map.side_len):
        line = []
        for loc, sym in square_map.items():
            if loc.row == row:
                line.append((loc, sym))
        line.sort()
        print(' '.join((str(e[1]) for e in line)))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('file')
    args = parser.parse_args()
    square_map = parse_input_file(args.file)
    pprint.pprint(solve(square_map))


if __name__ == '__main__':
    main()
