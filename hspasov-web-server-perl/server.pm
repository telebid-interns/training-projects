use strict;
use warnings;
use diagnostics;
use POSIX;
use Socket;
use Cwd;
use client_connection;
use logger;
use config;
use web_server_utils;

our %CONFIG;
our %CLIENT_CONN_STATES;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);
my $EX_OK = 0;
my $EX_SOFTWARE = 70;
my $EX_OSERR = 71;

package Server;

sub new {
    my $class = shift;

    $SIG{CHLD} = sub {
        my $wait_any_child_indicator = -1;

        while ((my $child_pid = waitpid($wait_any_child_indicator, POSIX::WNOHANG)) > 0) {
            $log->error($DEBUG, msg => "Child with pid $child_pid reaped. Exit status: $?");
        }
    };

    my $conn;

    socket($conn, Socket::PF_INET, Socket::SOCK_STREAM, getprotobyname('tcp')) or die("socket: $!");
    setsockopt($conn, Socket::SOL_SOCKET, Socket::SO_REUSEADDR, 1) or die("setsockopt: $!");

    my $self = {
        _conn => $conn
    };

    bless($self, $class);
    return $self;
}

sub run {
    my $self = shift;

    bind($self->{_conn}, Socket::pack_sockaddr_in($CONFIG{port}, Socket::inet_aton($CONFIG{host}))) or die("bind: $!");

    $log->error($DEBUG, msg => "bound");

    listen($self->{_conn}, $CONFIG{backlog});

    $log->error($DEBUG, msg => "listening on $CONFIG{port}");

    my $client_conn;
    my $pid;

    while (1) {
        $client_conn = $self->accept();

        $pid = fork();

        if (!defined($pid)) {
            die("fork: $!");
        }

        if ($pid == 0) { # child process
            my $process_status = $EX_OK;

            # SIGCHLD signals should only be handled by parent, discarding reaping
            $SIG{CHLD} = "DEFAULT";

            $self->stop();

            $log->init_access_log_file();

            # may send response to client in case of invalid request
            $client_conn->receive_meta();

            if ($client_conn->{state} ne $CLIENT_CONN_STATES{RECEIVING}) {
                last;
            }

            $log->error($DEBUG, msg => 'resolving file path...');

            # TODO assert

            # ignoring query params
            my $max_fields_split = 2;
            my @req_target_split = split (/\?/, $client_conn->{req_meta}->{target}, $max_fields_split);
            my $req_target_path = $req_target_split[0];
            $log->error($DEBUG, var_name => 'req_target_path', var_value => $req_target_path);

            my $file_path = Cwd::abs_path($req_target_path);
            $log->error($DEBUG, var_name => 'file_path', var_value => $file_path);

            $log->error($DEBUG, msg => 'requested file in web server document root');

            # TODO CGI

            $client_conn->serve_static_file(web_server_utils::resolve_static_file_path($file_path));

            $client_conn->shutdown();
            $client_conn->close();

            $log->access(
                remote_addr => "$client_conn->{remote_addr}:$client_conn->{remote_port}",
                req_line => $client_conn->{req_meta}->{req_line_raw},
                user_agent => $client_conn->{req_meta}->{user_agent},
                status_code => $client_conn->{res_meta}->{status_code},
                content_length => $client_conn->{res_meta}->{content_length},
            );

            $log->close_access_log_file();

            exit($process_status);
        } else { # parent process
            $log->error($DEBUG, msg => "New child created with pid $pid");
        }
    }
}

sub accept {
    my $self = shift;

    $log->error($DEBUG, msg => "going to accept..");

    my $client_conn;
    my $packed_addr = accept($client_conn, $self->{_conn}) or die("Accept failed: $!");
    my ($port, $addr) = Socket::unpack_sockaddr_in($packed_addr);

    $log->error($DEBUG, msg => "Connection accepted");
    $log->error($DEBUG, var_name => "port", var_value => $port);
    $log->error($DEBUG, var_name => "addr", var_value => $addr);

    return new ClientConnection($client_conn, $port, $addr);
}

sub stop {
    my $self = shift;

    $log->error($DEBUG);
    close($self->{_conn}) or die("close: $!");
}
