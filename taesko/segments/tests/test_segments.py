import pytest

import segments.segments as segments



@pytest.mark.parametrize('line_length,a_step,b_step,c_length,expected', [
    (
        9, 3, 2, 1, ([(0, 1), (5, 6)], [(6, 7)])
    ),
    (
        10, 3, 2, 1, ([(2, 3), (3, 4)], [(8, 9), (9, 10)])
    )
])
def test_segs_by_full_length(line_length, a_step, b_step, c_length, expected):
    assert segments.segs_by_full_length(line_length, a_step, b_step, c_length) == expected


@pytest.mark.parametrize('red_segments,expected', [
    ([(0, 1), (0, 2), (1, 3), (2, 5)], [(0, 5)]),
    ([(0, 5), (2, 7), (10, 15), (14, 15), (20, 21)], [(0, 7), (10, 15), (20, 21)])

])
def test_concat_red_segments(red_segments, expected):
    assert segments.concat_red_segments(red_segments) == expected


@pytest.mark.parametrize('string,expected', [
    ('9 3 2 1', 6),
    ('10 2 3 1', 6),
    ('20 2 3 1', 14),
    ('20 3 2 3', 2)
])
def test_solution_2(string, expected):
    assert segments.solution_2(string) == expected
