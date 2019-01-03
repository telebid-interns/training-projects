use strict;
use warnings;
use diagnostics;
use JSON;

if (@ARGV != 1) {
    my $arr_len = scalar @ARGV;
    die 'Expected 1 arg: config file!';
}

open my $config_file, $ARGV[0] or die "Could not open config file: $!";

my $config_str = do { local $/; <$config_file> };
my $config_parsed = decode_json $config_str;

close $config_file or warn "Config file close failed: $!";

our %CONFIG = %$config_parsed;
