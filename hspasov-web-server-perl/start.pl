use strict;
use warnings;
use sigtrap;
use diagnostics;
use lib './';
use server;
use config;

my %CONFIG = config;

sub start {
    print $CONFIG{port};

    my $server = new Server;

    $server->run
}

# TODO make a daemon

start()
