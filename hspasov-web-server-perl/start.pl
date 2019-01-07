use strict;
use warnings;
use sigtrap;
use diagnostics;
use lib './';
use Scalar::Util qw(blessed);
use server qw(Server);
use error_handling qw(assert);
use config;
use logger;

our %CONFIG;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

sub start {
    my $server = new Server();

    eval {
        $server->run();
        1;
    } or do {
        print "\n";
        print $@;
        print "\n";
        assert(blessed($@) eq 'Error');

        $log->error($ERROR, msg => $@->{msg});
    };

    $server->stop();
}

# TODO make a daemon

start();
