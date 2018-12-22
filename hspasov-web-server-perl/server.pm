use strict;
use warnings;
use diagnostics;
use Socket;
use config;

my %CONFIG = config;

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

    bind $self->{_conn}, Socket::pack_sockaddr_in($CONFIG{port}, Socket::inet_pton(Socket::PF_INET, $CONFIG{host})) or die "bind: $!";

    print "bound";
}
