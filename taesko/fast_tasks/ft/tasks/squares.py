import math
import collections
import sys
import pprint

Location = collections.namedtuple('Location', ['row', 'col'])


def construct_square_map(length, symbols):
    dct = {}

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
        assert len(allowed) > 2 or symbol not in allowed, '{symbol} is alone in {allowed}'.format(**locals())

        try:
            allowed.remove(symbol)
            modified = True
        except ValueError:
            pass

    return modified


def locations_affected_by_location(square_map, location):
    affected_rows = [Location(row, location.col) for row in range(len(square_map))]
    affected_cols = [Location(location.row, col) for col in range(len(square_map))]
    affected_square = []
    nested_square_len = int(math.sqrt(len(square_map)))
    square_row = location.row // nested_square_len
    square_col = location.col // nested_square_len
    for row in range(square_row, nested_square_len):
        for col in range(square_col, nested_square_len):
            affected_square.append(Location(row, col))

    return set(affected_rows + affected_cols + affected_square)


def solve(square_map):
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
        assert not modified_any and finished, 'Unsolvable puzzle by algorithm'
        if finished:
            return square_map


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
        symbols = [s for s in line.split() if s]
        for col, sym in enumerate(symbols):
            if sym == '0':
                continue
            symbol_loc_map[Location(row, col)] = sym

    all_symbols = set(symbol_loc_map.values())
    total_square_len = int(math.pow(mini_square_length, 4))
    square_map = construct_square_map(total_square_len, all_symbols)

    for loc, symbol in symbol_loc_map.items():
        insert_symbol(square_map, loc, symbol)

    return square_map


def main():
    square_map = parse_input_file('test_cases/squares/input_1.txt')
    pprint.pprint(solve(square_map))


if __name__ == '__main__':
    main()
