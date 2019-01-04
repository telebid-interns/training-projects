use strict;
use warnings;
use diagnostics;
use Socket;
use logger;
use config;

our %CONFIG;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

package Server;

sub new {
    my $class = shift;

    my $conn;

    socket($conn, Socket::PF_INET, Socket::SOCK_STREAM, getprotobyname 'tcp') or die "socket: $!";
    setsockopt($conn, Socket::SOL_SOCKET, Socket::SO_REUSEADDR, 1) or die "setsockopt: $!";

    my $self = {
        _conn => $conn
    };

    bless $self, $class;
    return $self;
}

sub run {
    my $self = shift;

    bind $self->{_conn}, Socket::pack_sockaddr_in($CONFIG{port}, Socket::inet_aton($CONFIG{host})) or die "bind: $!";

    $log->error($DEBUG, msg => "bound");

    listen $self->{_conn}, $CONFIG{backlog};

    $log->error($DEBUG, msg => "listening on $CONFIG{port}");


    my $client_conn;
    my $pid;

    while (1) {
        $client_conn = $self->accept;
    }
}

sub accept {
    my $self = shift;

    $log->error($DEBUG, msg => "going to accept..");

    my $client_conn;
    my $packed_addr = accept $client_conn, $self->{_conn} or die "Accept failed: $!";
    my ($port, $addr) = Socket::unpack_sockaddr_in($packed_addr); 

    $log->error($DEBUG, msg => "Connection accepted");
    $log->error($DEBUG, var_name => "port", var_value => $port);
    $log->error($DEBUG, var_name => "addr", var_value => $addr);

    return new ClientConnection($client_conn, $port, $addr);
}
