L = [1, 2, 4, 8, 16, 32, 64]
X = 5

stage = 3

if stage == 1:
    found = False
    i = 0

    while not found and i < len(L):
        if 2 ** X == L[i]:
            found = True
        else:
            i = i + 1

    if found:
        print('at index', i)
    else:
        print(X, 'not found')

elif stage == 2:
    i = 0

    while i < len(L):
        if 2 ** X == L[i]:
            print('at index', i)
            break;
        else:
            i = i + 1
    else:
        print(X, 'not found')

elif stage == 3:
    for i in L:
        if 2 ** X == i:
            print('at index', L.index(i))
            break;
    else:
        print(X, 'not found')

elif stage == 4:
    ...
