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


def all_paths(city_dict):
    paths = set((connection, ) for city, connected in city_dict.items() for connection in connected)
    visited_cities = set()
    for city, connected in city_dict.items():
        for connection in connected:
            new_paths = set(paths)
            for path in paths:
                try:
                    new_paths.add(connection.connect_to_path(path))
                except ValueError:
                    pass
            paths = new_paths
    paths = [tuple(p) for p in paths]
    new_paths = set()
    for p in paths:
        if p not in new_paths and tuple(reversed(p)) not in new_paths:
            new_paths.add(p)
    return new_paths


def is_solution(base_connections, paths, speed_map, minimal, maximum):
    cut_connections = [connection for connection, speed in speed_map.items() if not minimal<=speed<=maximum]
    new_paths = []
    for cut in cut_connections:
        city_a, city_b = cut
        for p in paths:
            try:
                a_index = p.index(city_a)
                b_index = p.index(city_b)
            except ValueError:
                new_paths.append(p)
                continue
            if abs(a_index - b_index) != 1:
                new_paths.append(p)
        paths = list(new_paths)
        new_paths.clear()
    for city, adjacent_cities in base_connections.items():
        for adjacent in adjacent_cities:
            are_connected = False
            for path in paths:
                if (path[0] == city and path[-1] == adjacent) or\
                        (path[0] == adjacent and path[-1] == city):
                    are_connected = True
                    break
            if not are_connected:
                return False
    return True


def find_solutions(city_dict, speeds):
    all_connections = all_paths(city_dict)
    speed_list = sorted(speeds.values())
    solutions = []
    speed_range = range(len(speed_list))
    while speed_range:
        minimum = speed_list[speed_range.start]
        maximum = speed_list[speed_range.stop-1]
        if is_solution(city_dict, all_connections, speeds, minimum, maximum):
            speed_range = range(speed_range.start+1, speed_range.stop)
            solutions.append((minimum, maximum))
        else:
            speed_range = range(speed_range.start-1, speed_range.stop)
            break

    while speed_range:
        minimum = speed_list[speed_range.start]
        maximum = speed_list[speed_range.stop-1]
        if is_solution(city_dict, all_connections, speeds, minimum, maximum):
            speed_range = range(speed_range.start, speed_range.stop-1)
            solutions.append((minimum, maximum))
        else:
            speed_range = range(speed_range.start, speed_range.stop+1)
            break

    return solutions


def best_solution(solutions):
    return min(sorted(solutions), key=lambda sol: int(sol[1]) - int(sol[0]))


def parse_input(string):
    lines = string.splitlines()[1:]
    city_dict = collections.defaultdict(list)
    speed_dict = {}
    for line in lines:
        city_a, city_b, optimal_speed = line.split(' ')
        city_dict[city_a].append(city_b)
        city_dict[city_b].append(city_a)
        speed_dict[(city_a, city_b)] = optimal_speed
    return city_dict, speed_dict


def test(city_dict, speeds, expected):
    solutions = find_solutions(city_dict, speeds)
    print(solutions)
    best = best_solution(solutions)
    print(best)
    assert best == expected


if __name__ == '__main__':
    city_dict_1 = {
        'A': [Connection('A', 'C', 50), Connection('A', 'B', 90)],
        'B': [Connection('B', 'A', 90), Connection('B', 'C', 70), Connection('B', 'D', 40)],
        'C': [Connection('C', 'A', 50), Connection('C', 'B', 70)],
        'D': [Connection('D', 'B', 40)]
    }
    speeds_1 = {('A', 'B'): 90,
                ('A', 'C'): 50,
                ('B', 'C'): 70,
                ('B', 'D'): 40}
    assert Connection('A', 'C', 50) == Connection('C', 'A', 50)
    paths = sorted(all_paths(city_dict_1))
    print(len(paths))
    for path in paths:
        for c in path:
            print(str(c), end=', ')
        print('\n')
    sample_input = """7 10
1 3 2
4 2 8
1 2 11
1 4 3
1 3 6
5 3 5
3 6 9
7 6 6
5 6 3
2 5 7"""
    # cd, sd = parse_input(sample_input)
    # test(cd, sd, (3, 7))


