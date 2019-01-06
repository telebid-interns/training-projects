use strict;
use warnings;
use diagnostics;
use Fcntl;
use config;
use Time::Format;
use Time::HiRes;

our $ERROR = 1;
our $WARNING = 2;
our $DEBUG = 3;
our $INFO = 4;

our $log;
our %CONFIG;

package Logger;

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
        my @fields = ();

        if (grep {$_ eq 'pid'} @{$CONFIG{error_log_fields}}) {
            push(@fields, $$);
        }
        if (grep {$_ eq 'timestamp'} @{$CONFIG{error_log_fields}}) {
            my $time = Time::HiRes::gettimeofday();
            # TODO check HOW does %time get two scalars for keys?
            push(@fields, $Time::Format::time{"yyyy-mm-dd hh:mm:ss.mmm", $time});
        }
        if (grep {$_ eq 'level'} @{$CONFIG{error_log_fields}}) {
            push(@fields, $level);
        }
        if (grep {$_ eq 'context'} @{$CONFIG{error_log_fields}}) {
            my ($package, $filename, $line) = caller;
            push(@fields, "<$filename>$package(L$line)");
        }
        if (grep {$_ eq 'var_name'} @{$CONFIG{error_log_fields}}) {
            if ($params{var_name}) {
                push(@fields, $params{var_name});
            } else {
                push(@fields, $CONFIG{error_log_empty_field});
            }
        }
        if (grep {$_ eq 'var_value'} @{$CONFIG{error_log_fields}}) {
            if ($params{var_value}) {
                push(@fields, $params{var_value});
            } else {
                push(@fields, $CONFIG{error_log_empty_field});
            }
        }
        if (grep {$_ eq 'msg'} @{$CONFIG{error_log_fields}}) {
            if ($params{msg}) {
                push(@fields, $params{msg});
            } else {
                push(@fields, $CONFIG{error_log_empty_field});
            }
        }

        print(join($CONFIG{error_log_field_sep}, @fields));
        print("\n");
    }
}

sub access {
    my $self = shift;
    my %params = @_;

    if ($CONFIG{access_log_enabled}) {
        if (!$self->{access_log_file}) {
            $self->error($ERROR, msg => "Attempt to write in uninitialized access log file");
        } else {
            my @fields = ();

            if (grep {$_ eq 'pid'} @{$CONFIG{access_log_fields}}) {
                push(@fields, $$);
            }
            if (grep {$_ eq 'timestamp'} @{$CONFIG{access_log_fields}}) {
                my $time = Time::HiRes::gettimeofday();
                # TODO check HOW does %time get two scalars for keys?
                push(@fields, $Time::Format::time{"yyyy-mm-dd hh:mm:ss.mmm", $time});
            }
            if (grep {$_ eq 'remote_addr'} @{$CONFIG{access_log_fields}}) {
                if ($params{remote_addr}) {
                    push(@fields, $params{remote_addr});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'req_line'} @{$CONFIG{access_log_fields}}) {
                if ($params{req_line}) {
                    push(@fields, $params{req_line});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'user_agent'} @{$CONFIG{access_log_fields}}) {
                if ($params{user_agent}) {
                    push(@fields, $params{user_agent});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'status_code'} @{$CONFIG{access_log_fields}}) {
                if ($params{status_code}) {
                    push(@fields, $params{status_code});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }
            if (grep {$_ eq 'content_length'} @{$CONFIG{access_log_fields}}) {
                if ($params{content_length}) {
                    push(@fields, $params{content_length});
                } else {
                    push(@fields, $CONFIG{access_log_empty_field});
                }
            }

            print($self->{access_log_file}, join($CONFIG{access_log_field_sep}, @fields));
            print("\n");
        }
    }
}

sub init_access_log_file {
    my $self = shift;

    sysopen(my $fh, $CONFIG{access_log}, Fcntl::O_WRONLY | Fcntl::O_CREAT | Fcntl::O_APPEND) or die("sysopen '$CONFIG{access_log}':");

    $self->{access_log_file} = $fh;
}

sub close_access_log_file {
    my $self = shift;

    close($self->{access_log_file});
    $self->{access_log_file} = undef;
}

$log = new Logger();
