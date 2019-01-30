CXXFLAGS = -g -Wall -pedantic -g -rdynamic

OBJ = main.o

OUT = server

$(OUT): $(OBJ)
	g++ $(CXXFLAGS) $(OBJ) -o $(OUT)

clean:
	rm -f *~ $(OUT) *.o
