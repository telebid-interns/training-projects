CXXFLAGS = -g -Wall -pedantic -g -rdynamic

OBJ = main.o server.o client_connection.o socket.o config.o logger.o web_server_utils.o error.o http_msg_formatter.o

OUT = server

$(OUT): $(OBJ)
	g++ $(CXXFLAGS) $(OBJ) -o $(OUT)

clean:
	rm -f *~ $(OUT) *.o
