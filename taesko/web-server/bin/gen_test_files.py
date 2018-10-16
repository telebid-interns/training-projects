#!/usr/bin/env python3
import argparse


UNITS = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
}
WRITE_CHUNK_SIZE = 4096 * 4096


def generate_file(size):
    for _ in range(size):
        yield 'a'


def iter_chunks(iterable, size):
    it = iter(iterable)
    while True:
        chunk = []
        try:
            for _ in range(size):
                chunk.append(next(it))
        except StopIteration:
            if chunk:
                yield chunk
            break
        yield chunk


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('size', help='File size (default in KB)', type=int,
                        default=1)
    parser.add_argument('-p', '--path',
                        help='File path where to save the file.')
    parser.add_argument('-u', '--unit', help='Unit of size argument',
                        default='KB', choices=UNITS.keys())
    args = parser.parse_args()

    size = args.size * UNITS[args.unit]
    chunks = iter_chunks(generate_file(size), WRITE_CHUNK_SIZE)
    line = 'Test file of size around {} {}'.format(size, args.unit)

    if args.path:
        with open(args.path, mode='w') as f:
            f.write(line)
            for chunk in chunks:
                ''.join(chunk)
    else:
        print(line)
        for chunk in chunks:
            print(''.join(chunk), end='')


if __name__ == '__main__':
    main()
