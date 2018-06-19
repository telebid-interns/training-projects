def point_coords(line_length, step):
    return range(0, line_length, step)


def segs_by_length(line_length, a_coords, b_coords, length):
    for a in a_coords:
        for b in b_coords:
            if abs(a - b) == length:
                yield (a, b)


def concat_segments(seg_1, seg_2):
    if seg_1[0]<=seg_2[0]<=seg_1[1]:
        return seg_1[0], seg_2[1]
    else:
        raise ValueError("Segments can't be concatenated")


def concat_red_segments(segments):
    segments = sorted(tuple(sorted(seg)) for seg in segments)
    red_segments = []
    for seg in segments:
        for red_seg in tuple(red_segments):
            try:
                concated = concat_segments(red_seg, seg)
                red_segments.remove(red_seg)
                red_segments.append(concated)
                break
            except ValueError:
                pass
        else:
            red_segments.append(seg)
    return red_segments


def total_red_length(red_segments):
    return sum(abs(seg[0] - seg[1]) for seg in red_segments)


def parse_input_string(string):
    return [int(num) for num in string.split(' ') if num]


def solve_input_string(string):
    line_length, a_step, b_step, c_length = parse_input_string(string)
    a_coords = range(0, line_length, a_step)
    b_coords = range(line_length, 0, -b_step)
    segs = list(segs_by_length(line_length, a_coords, b_coords, c_length))
    reds = concat_red_segments(segs)
    return line_length - total_red_length(reds)


def main():
    line_length = 10
    a_step = 2
    b_step = 3
    c_length = 1
    print(solve_input_string('10 2 3 1'))


if __name__ == '__main__':
    main()
