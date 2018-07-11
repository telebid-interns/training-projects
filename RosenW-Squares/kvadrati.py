n = input()
size = n**2

matrix = []

for i in range(size):
    line = raw_input().split()
    matrix.append(line)

print('unsolved')
print(matrix)

symbols = []

for i in range(size):
    for j in range(size):
    	print matrix[i][j]
    	if matrix[i][j] not in symbols and matrix[i][j] != '0':
    		symbols.append(matrix[i][j])

print symbols

done = False
while not done:
	done = True
	for i in range(size):
	    for j in range(size):
	    	if matrix[i][j] == '0':
	    		done = False

	for s in symbols:
		for i in range(size):
		    for j in range(size):
		    	if matrix[i][j] == '0':
		    		print('s: ' + str(s) + ' i: ' + str(i) + ' j: ' + str(j))
		    		rightPlace = True
				for k in range(n*(i//n), n + n*(i//n)): # test if symbol in square, n*i//n - current box starting point x
				    for l in range(n*(j//n), n + n*(j//n)):
				    	print('checking ' + str(k) + ' - ' + str(l))
				    	if matrix[k][l] == s:
				    		rightPlace = False
				for k in range(size):
					if matrix[i][k] == s: # test if symbol in row
						rightPlace = False
				for k in range(size):
					if matrix[k][j] == s: # test if symbol in col
						rightPlace = False
				if rightPlace:
					print('assigning ' + s + ' at position ' + str(i) + ' - ' + str(j))
					matrix[i][j] = s
					print(matrix)
					a = raw_input()

print('solved')
print(matrix)

# 2
# 0 0 1 2
# 0 0 0 0
# 3 0 0 0
# 0 1 0 4
