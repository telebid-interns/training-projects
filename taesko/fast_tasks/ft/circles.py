import collections
import math
from pprint import pprint


Circle = collections.namedtuple('Circle', ['x', 'y', 'radius'])


def intersecting(circle_a, circle_b):
    x_diff = circle_a.x - circle_b.x
    y_diff = circle_a.y - circle_b.y
    distance = math.sqrt(x_diff**2 + y_diff**2)

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


def find_path(graph, start, end):
    """ Depth first search."""
    visited, queue = set(), collections.deque([[start]])

    while queue:
        path = queue.popleft()
        last_node = path[-1]
        if last_node == end:
            return path

        for adjacent_node in graph[last_node]:
            if adjacent_node not in visited:
                new_path = [*path, adjacent_node]
                queue.append(new_path)
                visited.add(adjacent_node)


def parse_input(string):
    lines = (line for line in string.splitlines() if line)
    next(lines)  # skip first
    for line in lines:
        numbers = [int(num) for num in line.split() if num]
        yield Circle(*numbers)


def main():
    with open('input.txt', mode='r') as f:
        circles = list(parse_input(f.read()))
    print(circles)
    graph = graph_from_circles(circles)
    pprint(graph)
    path = find_path(graph, circles[0], circles[-1])
    print(len(path) - 1)


if __name__ == '__main__':
    main()
