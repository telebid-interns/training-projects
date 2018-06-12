import collections
import functools
import itertools

_Connection = collections.namedtuple('Connection', ['city_a', 'city_b', 'weight'])


class Connection(_Connection):
    def other_city(self, city):
        if city == self.city_a:
            return self.city_b
        elif city == self.city_b:
            return self.city_a
        else:
            raise ValueError("{} is not connected to {}".format(city, self))

    def can_connect_to_other(self, other):
        if isinstance(other, self.__class__):
            other = other[:-1]
        if self[:-1] == other[:-1]:
            return False
        elif self.city_b not in other:
            if self.city_a == other[0]:
                return True
            elif self.city_a == other[-1]:
                return True
        elif self.city_a not in other:
            if self.city_b == other[0]:
                return True
            elif self.city_b == other[-1]:
                return True
        return False

    def connect_to_path(self, path):
        if self in path:
            raise ValueError("{} can't connect to {}".format(self, path))
        if self.can_connect_to_other(path[0]):
            return (self, *path)
        elif self.can_connect_to_other(path[-1]):
            return (*path, self)
        else:
            raise ValueError("{} can't connect to {}".format(self, path))

    def __repr__(self):
        return "{}{}({})".format(self.city_a, self.city_b, self.weight)

    def __hash__(self):
        return hash(self.city_a) ^ hash(self.city_b) ^ hash(self.weight)

    def __eq__(self, other):
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.weight == other.weight and self.city_a in other and self.city_b in other


def backtrack(path, last_city, next_city):
    new_path = path[:-1]
    return new_path, new_path[-1].other_city(last_city), last_city


class DepthFirstIterator:
    def __init__(self, graph, start, excluding_cities=None):
        self.graph = graph
        self.start = start
        self.excluding = excluding_cities if excluding_cities else set()
        self.path_stack = [(start, list(self.walkable_edges(start)))]
        self.passed_cities = set()
        self.current_path = ()

    @property
    def current_city(self):
        return self.path_stack[-1][0]

    @property
    def next_edges(self):
        return self.path_stack[-1][1]

    def walkable_edges(self, node):
        for edge in self.graph[node]:
            if edge.other_city(node) not in self.excluding:
                yield edge

    def __next__(self):
        if not self.path_stack:
            raise StopIteration()
        while not self.can_advance():
            self.backtrack()
            if not self.path_stack:
                raise StopIteration()
        return self.advance()

    def __iter__(self):
        return self

    def can_advance(self):
        has_edges = bool(self.next_edges)
        is_circular = self.current_city in self.passed_cities
        return has_edges and not is_circular

    def advance(self):
        assert self.can_advance()
        edge = self.next_edges.pop()
        city = edge.other_city(self.current_city)
        self.passed_cities.add(self.current_city)
        frame = (city, list(self.walkable_edges(city)))
        self.path_stack.append(frame)
        self.current_path += (edge, )
        return self.current_path

    def backtrack(self):
        assert not self.path_stack or self.current_city in self.passed_cities or not self.next_edges
        self.path_stack.pop()
        if self.passed_cities:
            self.passed_cities.remove(self.current_city)
        self.current_path = self.current_path[:-1]


def all_paths_from(city_dict, city_a):
    yield from DepthFirstIterator(city_dict, city_a)


def all_paths(city_dict):
    exclucions = itertools.accumulate(itertools.chain([[None]], city_dict.keys()),
                                      lambda lst, city: lst + [city])
    for city, excluded in zip(city_dict, exclucions):
        yield from DepthFirstIterator(city_dict, city, excluding_cities=set(excluded))


def has_path_between(paths, city_a, city_b):
    for p in paths:
        a_found = False
        b_found = False
        for conn in p:
            a_found = True if city_a in conn else a_found
            b_found = True if city_b in conn else b_found
            if a_found and b_found:
                return True
    return False


def is_solution(base_connections, paths, minimal, maximum):
    cut_connections = [conn for connections in base_connections.values() for conn in connections
                       if not minimal <= conn.weight <= maximum]
    for cut in cut_connections:
        paths = [p for p in paths if cut not in p]
    for city, connections in base_connections.items():
        for conn in connections:
            if not has_path_between(paths, conn.city_a, conn.city_b):
                return False
    return True


def find_solutions(city_dict):
    all_connections = all_paths(city_dict)
    speed_list = sorted(set(conn.weight for connections in city_dict.values() for conn in connections))
    solutions = []
    for a in speed_list[:-1]:
        for b in speed_list[1:]:
            if is_solution(city_dict, all_connections, a, b):
                solutions.append((a, b))
    return solutions


def best_solution(solutions):
    return min(sorted(solutions), key=lambda sol: int(sol[1]) - int(sol[0]))


def parse_input(string):
    lines = string.splitlines()[1:]
    city_dict = collections.defaultdict(list)
    for line in lines:
        ca, cb, s = line.split(' ')
        s = int(s)
        city_dict[ca].append(Connection(ca, cb, s))
        city_dict[cb].append(Connection(cb, ca, s))
    return city_dict


def test(city_dict, expected):
    solutions = find_solutions(city_dict)
    best = best_solution(solutions)
    assert best == expected


def test_input(string, expected):
    test(parse_input(string), expected)
    print("Passed.")


def main():
    city_dict_1 = {
        'A': [Connection('A', 'C', 50), Connection('A', 'B', 90), Connection('A', 'C', 10)],
        'B': [Connection('B', 'A', 90), Connection('B', 'C', 70), Connection('B', 'D', 40)],
        'C': [Connection('C', 'A', 50), Connection('C', 'B', 70), Connection('C', 'A', 10)],
        'D': [Connection('D', 'B', 40)]
    }
    for path in all_paths(city_dict_1):
        print(path)
    # sample_input = open('sample_1.input', mode='r').read()
    # sample_input_2 = open('sample_2.input', mode='r').read()
    # large_input = open('large.input', mode='r').read()
    # test_input(sample_input, (3, 7))
    # print(best_solution(find_solutions(parse_input(sample_input_2))))
    # print(best_solution(find_solutions(parse_input(large_input))))


if __name__ == '__main__':
    main()

