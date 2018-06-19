import pytest

import segments.segments as segments



@pytest.mark.parametrize('red_segments,expected', [
    ([(0, 1), (0, 2), (1, 3), (2, 5)], [(0, 5)])
])
def test_concat_red_segments(red_segments, expected):
    assert segments.concat_red_segments(red_segments) == expected
