from pprint import pprint


class Berry:
    def __init__(self, infected, infected_now, row, col):
        self.infected = infected
        self.infected_now = infected_now
        self.row = row
        self.col = col

    @classmethod
    def from_bitmap(cls, bitmap):
        garden = []

        for row, infections in enumerate(bitmap):
            berries = []
            for col, infected_state in enumerate(infections):
                if infected_state:
                    b = cls(True, False, row, col)
                else:
                    b = cls(False, False, row, col)
                berries.append(b)
            garden.append(berries)

        return garden

    def __repr__(self):
        return "Berry({self.infected}, {self.infected_now}, {self.row}, {self.col})".format(self=self)


def neighbours(garden, row, col):
    result = [(row + 1, col),
              (row - 1, col),
              (row, col + 1),
              (row, col - 1)]

    for new_row, new_col in list(result):
        if not 0 < new_row < len(garden) or not 0 < new_col < len(garden[0]):
            result.remove((new_row, new_col))

    return result


def advance_day(garden):
    for row, berries in enumerate(garden):
        for col, berry in enumerate(berries):
            if berry.infected and not berry.infected_now:
                for neigh_row, neigh_col in neighbours(garden, row, col):
                    berry = garden[neigh_row][neigh_col]
                    berry.infected = True
                    berry.infected_now = True

    for berries in garden:
        for berry in berries:
            berry.infected_now = False

    return garden


if __name__ == '__main__':
    garden = Berry.from_bitmap(
        [[True, False, False],
        [False, False, True],
        [False, False, True]]
    )
    days = 2
    pprint(garden)

    # print("Next day:")
    # pprint(advance_day(garden))


