use strict;
use warnings;
use diagnostics;
use Scalar::Util qw(looks_like_number);
use Fcntl qw();
use JSON qw();
use error_handling qw(assert);

if (@ARGV != 1) {
    my $arr_len = scalar(@ARGV);
    die('Expected 1 arg: config file!');
}

sysopen(my $config_file, $ARGV[0], Fcntl::O_RDONLY) or die("Could not open config file: $!");

my $config_str = do { local $/; <$config_file> };
my $config_parsed = JSON::decode_json $config_str; # TODO check what happens when file not JSON

close($config_file) or warn("Config file close failed: $!");

assert(looks_like_number($config_parsed->{socket_operation_timeout}));
assert(looks_like_number($config_parsed->{read_buffer}));
assert(looks_like_number($config_parsed->{recv_buffer}));
assert(looks_like_number($config_parsed->{req_meta_limit}));
assert(looks_like_number($config_parsed->{backlog}));
assert(!ref($config_parsed->{protocol}));
assert(!ref($config_parsed->{host}));
assert(looks_like_number($config_parsed->{port}));
assert(looks_like_number($config_parsed->{error_log_level}));
assert(ref($config_parsed->{error_log_fields}) eq 'ARRAY');
assert(looks_like_number($config_parsed->{access_log_enabled})); # TODO check if this works properly
assert(ref($config_parsed->{access_log_fields}) eq 'ARRAY');
assert(!ref($config_parsed->{access_log_field_sep}));
assert(!ref($config_parsed->{error_log_field_sep}));
assert(!ref($config_parsed->{access_log_empty_field}));
assert(!ref($config_parsed->{error_log_empty_field}));

our %CONFIG = %$config_parsed;

1;
