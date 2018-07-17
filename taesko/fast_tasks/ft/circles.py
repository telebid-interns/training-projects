import collections
import argparse
import math
from pprint import pprint


Circle = collections.namedtuple('Circle', ['x', 'y', 'radius'])


def distance_between(circle_a, circle_b):
    x_diff = circle_a.x - circle_b.x
    y_diff = circle_a.y - circle_b.y
    return math.sqrt(x_diff**2 + y_diff**2)


def intersecting(circle_a, circle_b):
    distance = distance_between(circle_a, circle_b)
    close_enough = distance < circle_a.radius + circle_b.radius
    too_close = distance <= max(circle_a.radius, circle_b.radius) / 2

    return close_enough and not too_close


def graph_from_circles(circles):
    graph = collections.defaultdict(set)

    for circ_a in circles:
        for circ_b in circles:
            if intersecting(circ_a, circ_b):
                graph[circ_a].add(circ_b)

    return graph


def depth_first_search(graph, start, end):
    """ Depth first search."""
    visited, queue = set(), collections.deque([[start]])

    while queue:
        path = queue.popleft()
        last_node = path[-1]
        if last_node == end:
            yield path
            path = queue.popleft()
            last_node = path[-1]

        for adjacent_node in graph[last_node]:
            if adjacent_node not in visited:
                new_path = [*path, adjacent_node]
                queue.append(new_path)
                visited.add(adjacent_node)


def find_path(graph, start, end):
    try:
        return next(depth_first_search(graph, start, end))
    except StopIteration:
        return []


def find_shortest_path(graph, start, end):
    def path_distance(path):
        if not path:
            raise ValueError("Path argument is empty")
        distances = [distance_between(a, b) for a, b in zip(path[:-1], path[1:])]
        return sum(distances)

    paths = depth_first_search(graph, start, end)

    return min(paths, default=[], key=path_distance)


def parse_input(string):
    lines = (line for line in string.splitlines() if line)
    next(lines)  # skip first
    for line in lines:
        numbers = [int(num) for num in line.split() if num]
        yield Circle(*numbers)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input_file')
    parser.add_argument('-j', '--jumps', dest='jumps', action='store_true',
                        help='find minimal amount of jumps between circles to reach end')
    parser.add_argument('-p', '--path', dest='path', action='store_true',
                        help='find the jumps needed to reach the end fastest')
    args = parser.parse_args()
    with open(args.input_file, mode='r') as f:
        circles = list(parse_input(f.read()))
    graph = graph_from_circles(circles)
    if args.jumps and args.path:
        print("ERROR: Cannot specify both jumps and path flags at the same time.")
        return 1
    elif args.jumps:
        print("Finding minimum amount of jumps...")
        path = find_path(graph, circles[0], circles[-1])
    else:
        print("Finding shortest path...")
        path = find_shortest_path(graph, circles[0], circles[-1])

    print("Jumps made:", len(path) - 1)
    return 0


if __name__ == '__main__':
    main()
