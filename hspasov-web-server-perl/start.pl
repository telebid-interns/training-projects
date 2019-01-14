use strict;
use warnings;
use sigtrap;
use diagnostics;
use lib './';
use Scalar::Util qw(blessed);
use Server qw(Server);
use ErrorHandling qw(assert);
use ImportConfig;
use Logger;

our %CONFIG;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

sub start {
    my $server = new Server();

    eval {
        $server->run();
        1;
    } or do {
        assert(blessed($@) eq 'Error');

        $log->error($ERROR, msg => $@->{msg});
    };

    $server->stop();
}

# TODO make a daemon

start();
