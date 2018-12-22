use strict;
use warnings;
use diagnostics;
use JSON;

if (@ARGV != 1) {
    my $arr_len = scalar @ARGV;

    print "arr len is $arr_len";
    die 'Expected 1 arg: config file!';
}

open my $config_file, $ARGV[0] or die "Could not open config file: $!";

my $config_str = do { local $/; <$config_file> };
print "At config...\n";

my $config_parsed = decode_json $config_str;

close $config_file or warn "Config file close failed: $!";

sub config {
    return %$config_parsed;
}
