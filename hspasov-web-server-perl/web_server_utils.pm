use strict;
use warnings;
use diagnostics;
use File::Spec;
use Cwd;
use logger;
use config;

our %CONFIG;
our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

package web_server_utils;

sub trim {
    my $str = shift;

    $log->error($DEBUG);

    $str =~ s/^\s+|\s+$//g;

    return $str;
}

sub resolve_static_file_path {
    my $path = shift;

    $log->error($DEBUG, var_name => 'path', var_value => $path);

    my @web_server_root_path_split = split(/\//, $CONFIG{web_server_root});
    my @path_split = split(/\//, $path);

    my $resolved_path = Cwd::abs_path(File::Spec->catfile((shift(@web_server_root_path_split), shift(@path_split))));

    $log->error($DEBUG, var_name => 'resolved_path', var_value => $resolved_path);

    return $resolved_path;
}
