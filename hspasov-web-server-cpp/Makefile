CXXFLAGS = -g -Wall -pedantic

OBJ = main.o server.o client_connection.o socket.o

OUT = server

$(OUT): $(OBJ)
	g++ $(CXXFLAGS) $(OBJ) -o $(OUT)

clean:
	rm -f *~ $(OUT) *.o
