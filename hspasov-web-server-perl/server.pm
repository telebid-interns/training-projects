use strict;
use warnings;
use diagnostics;
use Socket;
use logger;
use config;

our %CONFIG;
our ($log, $INFO, $TRACE, $DEBUG);

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

    $log->error($DEBUG, msg => "bound\n");

    listen $self->{_conn}, $CONFIG{backlog};

    $log->error($DEBUG, msg => "listening on $CONFIG{port}\n");
}
