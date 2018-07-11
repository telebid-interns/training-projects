import argparse
import collections


CORRIDOR = ' '
WALL = '*'
EXIT = 'e'


class PathGraph:
    def __init__(self, row, col, type, *connections):
        if len(connections) > 4:
            raise ValueError("Labirynth can't connect to more than 4 paths. Got: ", connections)

        self.row = row
        self.col = col
        self.type = type
        self.connections = [*connections]

        for conn in connections:
            conn.connect(self)

    def connect(self, path):
        rd = abs(self.row - path.row)
        cd = abs(self.col - path.col)

        if rd + cd > 1:
            raise ValueError('Path {} cannot connect to {} - they are not adjacent', self, path)

        if len(self.connections) > 3:
            raise ValueError('Path {} cannot connect to {} - former has too many connections', self, path)

        self.connections.append(path)

    @classmethod
    def from_arrays(cls, arrays):
        pass


    def __repr__(self):
        return "Path({self.row}, {self.col}, {self.type})".format(**locals())


Corridor = collections.namedtuple('Corridor', ['row', 'col', 'type'])


def adjacent_corridors(lab, corridor):
    row, col = (corridor.row, corridor.col)
    adjacent_indexes = [(row + 1, col),
                        (row - 1, col),
                        (row, col + 1),
                        (row, col - 1)]
    adjacent = (lab[index] for index in adjacent_indexes)

    for adj in adjacent:
        if adj.type in (EXIT, CORRIDOR):
            yield adj


def lab_from_arrays(arrays):
    lab = []

    for row_index, row in enumerate(arrays):
        lab_row = [Corridor(row_index, col_index, type_)
                   for col_index, type_ in enumerate(row)]
        lab.append(lab_row)

    return lab


def find_exit(lab, start, end):
    visited = {start}
    current_path = [start]

    while current_path:
        corridor = current_path[-1]
        for adj in adjacent_corridors(lab, corridor):
            if adj.type == EXIT:
                current_path += adj
                return adj
            elif adj in visited:
                current_path = current_path[:-1]
            else:
                
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('file')

    args = parser.parse_args()

    with open(args.file, mode='r') as f:
        print(PathGraph.from_arrays(eval(f.read())))
