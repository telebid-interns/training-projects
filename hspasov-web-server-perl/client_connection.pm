use strict;
use warnings;
use diagnostics;
use Fcntl;
use logger;
use config;
use http_msg_formatter;

our %CONFIG;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

our %CLIENT_CONN_STATES = (
    ESTABLISHED => 'ESTABLISHED',
    RECEIVING => 'RECEIVING',
    SENDING => 'SENDING',
    CLOSED => 'CLOSED',
);

package ClientConnection;

sub new {
    my $class = shift;
    my $conn = shift;
    my $port = shift;
    my $addr = shift;

    my $self = {
        _conn => $conn,
        remote_addr => $addr,
        remote_port => $port,
        _req_meta_raw => "",
        _msg_buffer => undef,
        state => $CLIENT_CONN_STATES{ESTABLISHED},
        req_meta => undef,
        res_meta => {
            packages_sent => 0,
            headers => {},
            status_code => undef,
            content_length => undef,
        },
    };

    bless($self, $class);
    return $self;
}

sub receive_meta {
    my $self = shift;

    $log->error($DEBUG);

    $self->{state} = $CLIENT_CONN_STATES{RECEIVING};

    while (length($self->{_req_meta_raw}) <= $CONFIG{req_meta_limit}) {
        $log->error($DEBUG, msg => 'receiving data...');

        # TODO error handling
        $self->receive();

        $log->error($DEBUG, var_name => '_msg_buffer', var_value => $self->{_msg_buffer});

        $self->{_req_meta_raw} .= $self->{_msg_buffer};

        if (length($self->{_msg_buffer}) == 0) {
            $log->error($DEBUG, msg => 'connection closed by peer');
            return;
        }

        if (index($self->{_req_meta_raw}, "\r\n\r\n") != -1) {
            $log->error($DEBUG, msg => 'reached end of request meta');

            my $max_fields_split = 2;
            $self->{_msg_buffer} = (split(/\r\n\r\n/, $self->{_req_meta_raw}, $max_fields_split))[1];
            last;
        }
    }

    if (length($self->{_req_meta_raw}) >= $CONFIG{req_meta_limit}) {
        $log->error($DEBUG, msg => 'request message too long');
        $self->send_meta(400);
        return;
    }

    $log->error($DEBUG, msg => 'parsing request message...');

    $self->{req_meta} = http_msg_formatter::parse_req_meta($self->{_req_meta_raw});

    if (!$self->{req_meta}) {
        $log->error($DEBUG, msg => 'invalid request');
        $self->send_meta(400);
        return;
    }

    $log->error($DEBUG, var_name => 'req_meta', var_value => $self->{req_meta});
}

sub receive {
    my $self = shift;

    $log->error($DEBUG);

    my $no_flags = 0;

    my $recv_result = recv($self->{_conn}, $self->{_msg_buffer}, $CONFIG{recv_buffer}, $no_flags);

    if (!defined($recv_result)) {
        die("recv: $!");
    }
}

sub send_meta {
    my $self = shift;
    my $status_code = shift;
    my $headers_ref = shift;
    my %headers = %$headers_ref;

    $log->error($DEBUG, var_name => 'status_code', var_value => $status_code);
    $log->error($DEBUG, var_name => 'headers', var_value => \%headers);

    # TODO asserts

    $self->{state} = $CLIENT_CONN_STATES{SENDING};
    $self->{res_meta}->{status_code} = $status_code;

    my $result = http_msg_formatter::build_res_meta(
        status_code => $status_code, 
        headers => \%headers,
    );

    $log->error($DEBUG, var_name => 'result', var_value => $result);

    $self->send($result);
}

sub send {
    my $self = shift;
    my $data = shift;

    $log->error($DEBUG);

    # TODO asserts

    my $total_data_sent_length = 0;
    my $data_to_send_length = length($data);
    my $data_to_send = $data;

    while ($total_data_sent_length  < $data_to_send_length) {
        my $no_flags = 0;
        my $data_sent_length = send($self->{_conn}, $data_to_send, $no_flags);

        if ($data_sent_length == 0) {
            # TODO error
            $log->error($DEBUG, msg => '0 bytes sent after calling send!');
        }

        $total_data_sent_length += $data_sent_length;
        $data_to_send = substr($data, $total_data_sent_length);
    }

    $log->error($DEBUG, var_name => 'data', var_value => $data);
}

sub serve_static_file {
    my $self = shift;
    my $file_path = shift;
    $log->error($DEBUG, var_name => 'file_path', var_value => $file_path);

    # TODO chroot

    my $fh;

    sysopen($fh, $file_path, Fcntl::O_RDONLY) or die("sysopen: $!");

    $log->error($DEBUG, msg => 'requested file opened');

    $self->{res_meta}->{content_length} = -s $fh;

    $log->error($DEBUG, var_name => 'content_length', var_value => $self->{res_meta}->{content_length});

    $self->{res_meta}->{headers}->{'Content-Length'} = $self->{res_meta}->{content_length};
    $self->send_meta(200, $self->{res_meta}->{headers});
    $self->{res_meta}->{packages_sent} = 1;

    while (1) {
        my $data_length = sysread($fh, my $data, $CONFIG{read_buffer}) or die("sysread: $!");

        $log->error($DEBUG, var_name => 'data', var_value => $data);

        if ($data_length <= 0) {
            $log->error($DEBUG, msg => 'end of file reached while reading');
            last;
        }

        $self->send($data);
    }

    close($fh) or die("close: $!");
}

sub shutdown {
    my $self = shift;
    $log->error($DEBUG);

    my $shut_rdwr = 2;
    shutdown($self->{_conn}, $shut_rdwr) or die("shutdown: $!");
}

sub close {
    my $self = shift;
    $log->error($DEBUG);

    close($self->{_conn}) or die("close: $!");

    $self->{state} = $CLIENT_CONN_STATES{CLOSED};
}
