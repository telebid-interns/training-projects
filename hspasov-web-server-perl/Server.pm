use Logger;
use ImportConfig;
use ClientConnection;

our %CONFIG;
our %CLIENT_CONN_STATES;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

package Server;

use strict;
use warnings;
use diagnostics;
use Error qw(Error);
use POSIX qw();
use Socket qw();
use Cwd qw();
use WebServerUtils qw();
use ErrorHandling qw(assert);
use Scalar::Util qw(openhandle blessed);

my $EX_OK = 0;
my $EX_SOFTWARE = 70;
my $EX_OSERR = 71;

sub new {
    my $class = shift;

    $SIG{CHLD} = sub {
        local $!; # if signal interrupts a system call, preserve the system call's EINTR
        my $wait_any_child_indicator = -1;

        while ((my $child_pid = waitpid($wait_any_child_indicator, POSIX::WNOHANG)) > 0) {
            $log->error($DEBUG, msg => "Child with pid $child_pid reaped. Exit status: $?");
        }
    };

    my $conn;

    socket($conn, Socket::PF_INET, Socket::SOCK_STREAM, getprotobyname('tcp')) or die(new Error("socket: $!", \%!));
    setsockopt($conn, Socket::SOL_SOCKET, Socket::SO_REUSEADDR, 1) or die(new Error("setsockopt: $!", \%!));

    my $self = {
        _conn => $conn
    };

    bless($self, $class);
    return $self;
}

sub run {
    my $self = shift;

    assert(openhandle($self->{_conn}));

    bind($self->{_conn}, Socket::pack_sockaddr_in($CONFIG{port}, Socket::inet_aton($CONFIG{host}))) or die(new Error("bind: $!", \%!));

    $log->error($DEBUG, msg => "bound");

    listen($self->{_conn}, $CONFIG{backlog}) or die(new Error("listen: $!", \%!));

    $log->error($DEBUG, msg => "listening on $CONFIG{port}");

    my $client_conn;
    my $pid;

    while (1) {
        my $process_status = $EX_OK;

        eval {
            # TODO fix warning "You are exiting an eval by unconventional means"
            $client_conn = $self->accept() or next;

            assert(blessed($client_conn) eq 'ClientConnection');

            $pid = fork();

            if (!defined($pid)) {
                die(new Error("fork: $!", \%!));
            }

            if ($pid == 0) { # child process
                $process_status = $EX_OK;

                # SIGCHLD signals should only be handled by parent, discarding reaping
                $SIG{CHLD} = "DEFAULT";

                $self->stop();

                eval {
                    $log->init_access_log_file();

                    # may send response to client in case of invalid request
                    $client_conn->receive_meta();

                    if ($client_conn->{state} ne $CLIENT_CONN_STATES{RECEIVING}) {
                        die new Error('Client error', { CLIENT_ERR => 1 });
                    }

                    $log->error($DEBUG, msg => 'resolving file path...');

                    assert(!ref($client_conn->{req_meta}->{target}));

                    # ignoring query params
                    my $max_fields_split = 2;
                    my @req_target_split = split (/\?/, $client_conn->{req_meta}->{target}, $max_fields_split);
                    my $req_target_path = $req_target_split[0];
                    $log->error($DEBUG, var_name => 'req_target_path', var_value => $req_target_path);

                    my $file_path = Cwd::abs_path($req_target_path);
                    $log->error($DEBUG, var_name => 'file_path', var_value => $file_path);

                    $log->error($DEBUG, msg => 'requested file in web server document root');

                    $client_conn->serve_static_file(WebServerUtils::resolve_static_file_path($file_path));
                    1;
                } or do {
                    assert(blessed($@) eq 'Error');

                    if ($@->{origin}->{ENOENT}) {
                        $log->error($DEBUG, msg => 'ENOENT');
                        $log->error($DEBUG, msg => $@->{msg});

                        if (grep {$_ eq $client_conn->{state}} ('ESTABLISHED', 'RECEIVING')) {
                            $client_conn->send_meta(404);
                        }
                    } elsif ($@->{origin}->{EISDIR}) {
                        $log->error($DEBUG, msg => 'EISDIR');
                        $log->error($DEBUG, msg => $@->{msg});

                        if (grep {$_ eq $client_conn->{state}} ('ESTABLISHED', 'RECEIVING')) {
                            $client_conn->send_meta(404);
                        }
                    } elsif (!$@->{origin}->{CLIENT_ERR}) {
                        $log->error($ERROR, msg => $@->{msg});
                        $process_status = $EX_SOFTWARE;

                        if (grep {$_ eq $client_conn->{state}} ('ESTABLISHED', 'RECEIVING')) {
                            $client_conn->send_meta(500);
                        }
                    }
                };

                eval {
                    $client_conn->shutdown();
                    1;
                } or do {
                    assert(blessed($@) eq 'Error');

                    if (!$@->{origin}->{ENOTCONN}) {
                        $process_status = $EX_OSERR;
                        die($@);
                    }
                };
            } else { # parent process
                $log->error($DEBUG, msg => "New child created with pid $pid");
            }
            1;
        } or do {
            assert(blessed($@) eq 'Error');

            $log->error($DEBUG, msg => $@->{msg});
        };

        if (defined($client_conn) and $client_conn->{state} ne 'CLOSED') {
            eval {
                $client_conn->close();
                1;
            } or do {
                assert(blessed($@) eq 'Error');

                $log->error($DEBUG, msg => $@->{msg});
            };
        }

        if (defined($pid) and $pid == 0) { # child
            if (defined($client_conn)) {
                my $req_line;
                my $user_agent;

                if (defined($client_conn->{req_meta})) {
                    $req_line = $client_conn->{req_meta}->{req_line_raw};
                    $user_agent = $client_conn->{req_meta}->{user_agent};
                }

                $log->access(
                    req_line => $req_line,
                    user_agent => $user_agent,
                    status_code => $client_conn->{res_meta}->{status_code},
                    content_length => $client_conn->{res_meta}->{content_length},
                );
            }

            $log->close_access_log_file();
            exit($process_status);
        }
    }
}

sub accept {
    my $self = shift;

    $log->error($DEBUG, msg => "going to accept..");

    assert(openhandle($self->{_conn}));

    my $client_conn;
    my $packed_addr = accept($client_conn, $self->{_conn}) or do {
        if ($!{EINTR}) {
            $log->error($DEBUG, msg => 'accept interrupted by signal');
            return undef;
        }

        die(new Error("Accept failed: $!", \%!));
    };
    my ($port, $addr) = Socket::unpack_sockaddr_in($packed_addr);

    $log->error($DEBUG, msg => "Connection accepted");
    $log->error($DEBUG, var_name => "port", var_value => $port);
    $log->error($DEBUG, var_name => "addr", var_value => $addr);

    return new ClientConnection($client_conn, $port, $addr);
}

sub stop {
    my $self = shift;

    $log->error($DEBUG);

    assert(openhandle($self->{_conn}));

    close($self->{_conn}) or die(new Error("close: $!", \%!));
}

1;
