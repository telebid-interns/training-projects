import collections


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


def all_paths_from(city_dict, city_a):
    paths = []
    for connection in city_dict[city_a]:
        path_stacks = {}
        passed_cities = [city_a] # cities we've passed don't include the tip of the last connection
        current_path = (connection, )
        paths.append(current_path)
        last_city = city_a
        current_city = current_path[-1].other_city(last_city)
        while current_path:
            if current_path not in path_stacks:
                tracks = [conn for conn in city_dict[current_city] if conn not in current_path[-1]]
                path_stacks[current_path] = tracks
            try:
                next_conn = path_stacks[current_path].pop(0)
            except IndexError:
                # no more nodes - backtrack
                passed_cities.pop(-1)
                if len(current_path) > 1:
                    current_path, last_city, current_city = backtrack(current_path, last_city, current_city)
                else:
                    current_path = current_path[:-1]
                continue
            # don't enter a cycle in cyclic graphs
            if next_conn.other_city(current_city) in passed_cities:
                continue
            current_path += (next_conn, )
            paths.append(current_path)
            passed_cities.append(current_city)
            last_city, current_city = current_city, current_path[-1].other_city(current_city)
    return paths


def all_paths(city_dict):
    paths = [path for city in city_dict for path in all_paths_from(city_dict, city)]
    filtered = []
    for p in paths:
        if p not in filtered and tuple(reversed(p)) not in filtered:
            filtered.append(p)
    return filtered


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
    sample_input = open('sample_1.input', mode='r').read()
    sample_input_2 = open('sample_2.input', mode='r').read()
    large_input = open('large.input', mode='r').read()
    test_input(sample_input, (3, 7))
    print(best_solution(find_solutions(parse_input(sample_input_2))))
    print(best_solution(find_solutions(parse_input(large_input))))


if __name__ == '__main__':
    main()

