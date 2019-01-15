use ImportConfig;

our $ERROR = 1;
our $WARNING = 2;
our $DEBUG = 3;
our $INFO = 4;

our $log;
our %CONFIG;

package Logger;

use strict;
use warnings;
use diagnostics;
use Encode qw();
use Fcntl qw();
use Time::HiRes qw();
use POSIX qw();
use Data::Dumper qw();
use Error qw();

$Data::Dumper::Terse = 1;

sub new {
    my $class = shift;

    my $access_log_file;

    my $self = {
        access_log_file => $access_log_file
    };

    bless($self, $class);
    return $self;
}

sub error {
    my $self = shift;
    my $level = shift;
    my %params = @_;

    if ($level <= $CONFIG{error_log_level}) {
        my @fields;

        if (grep {$_ eq 'pid'} @{ $CONFIG{error_log_fields} }) {
            push(@fields, $$);
        }
        if (grep {$_ eq 'timestamp'} @{ $CONFIG{error_log_fields} }) {
            my $time = Time::HiRes::time();
            my ($ss, $mm, $hh, $DD, $MM, $Y) = localtime($time);
            my $us = int(($time - int($time)) * 1_000_000);
            my $time_str = POSIX::strftime("%Y-%m-%d %H:%M:%S", $ss, $mm, $hh, $DD, $MM, $Y) . ".$us";
            push(@fields, $time_str);
        }
        if (grep {$_ eq 'level'} @{ $CONFIG{error_log_fields} }) {
            push(@fields, $level);
        }
        if (grep {$_ eq 'context'} @{ $CONFIG{error_log_fields} }) {
            my ($package, $filename, $line) = caller();
            push(@fields, "<$filename>$package(L$line)");
        }
        if (grep {$_ eq 'var_name'} @{ $CONFIG{error_log_fields} }) {
            if ($params{var_name}) {
                push(@fields, $params{var_name});
            } else {
                push(@fields, $CONFIG{error_log_empty_field});
            }
        }
        if (grep {$_ eq 'var_value'} @{ $CONFIG{error_log_fields} }) {
            if ($params{var_value}) {
                push(@fields, Data::Dumper::Dumper($params{var_value}));
            } else {
                push(@fields, $CONFIG{error_log_empty_field});
            }
        }
        if (grep {$_ eq 'msg'} @{ $CONFIG{error_log_fields} }) {
            if ($params{msg}) {
                push(@fields, $params{msg});
            } else {
                push(@fields, $CONFIG{error_log_empty_field});
            }
        }

        print(STDERR join($CONFIG{error_log_field_sep}, @fields));
        print(STDERR "\n");
    }
}

sub access {
    my $self = shift;
    my %params = @_;

    if ($CONFIG{access_log_enabled}) {
        if (!$self->{access_log_file}) {
            $self->error($ERROR, msg => "Attempt to write in uninitialized access log file");
        } else {
            my @fields;

            if (grep {$_ eq 'pid'} @{ $CONFIG{access_log_fields} }) {
                push(@fields, $$);
            }
            if (grep {$_ eq 'timestamp'} @{ $CONFIG{access_log_fields} }) {
                my $time = Time::HiRes::time();
                my ($ss, $mm, $hh, $DD, $MM, $Y) = localtime($time);
                my $us = int(($time - int($time)) * 1_000_000);
                my $time_str = POSIX::strftime("%Y-%m-%d %H:%M:%S", $ss, $mm, $hh, $DD, $MM, $Y) . ".$us";
                push(@fields, $time_str);
            }
            if (grep {$_ eq 'req_line'} @{ $CONFIG{access_log_fields} }) {
                if ($params{req_line}) {
                    push(@fields, $params{req_line});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'user_agent'} @{ $CONFIG{access_log_fields} }) {
                if ($params{user_agent}) {
                    push(@fields, $params{user_agent});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'status_code'} @{ $CONFIG{access_log_fields} }) {
                if ($params{status_code}) {
                    push(@fields, $params{status_code});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'content_length'} @{ $CONFIG{access_log_fields} }) {
                if ($params{content_length}) {
                    push(@fields, $params{content_length});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }

            my $data_to_log = join($CONFIG{access_log_field_sep}, @fields);

            my $bytes_written_amount = syswrite($self->{access_log_file}, Encode::encode_utf8("$data_to_log\n"));

            if (!defined($bytes_written_amount)) {
                die(new Error("syswrite: $!", \%!));
            }
        }
    }
}

sub init_access_log_file {
    my $self = shift;

    sysopen(my $fh, $CONFIG{access_log}, Fcntl::O_WRONLY | Fcntl::O_CREAT | Fcntl::O_APPEND) or die(new Error("sysopen '$CONFIG{access_log}': $!", \%!));

    $self->{access_log_file} = $fh;
}

sub close_access_log_file {
    my $self = shift;

    close($self->{access_log_file}) or die(new Error("close: $!", \%!));
    $self->{access_log_file} = undef;
}

$log = new Logger();

1;
