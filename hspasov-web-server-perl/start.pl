use strict;
use warnings;
use sigtrap;
use diagnostics;
use lib './';
use server;
use config;

our %CONFIG;

sub start {
    my $server = new Server;

    $server->run
}

# TODO make a daemon

start()
