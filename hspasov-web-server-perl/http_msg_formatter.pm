use strict;
use warnings;
use diagnostics;
use logger;

our ($log, $ERROR, $WARNING, $DEBUG, $INFO);

my %response_reason_phrases = (
    200 => 'OK',
    400 => 'Bad Request',
    404 => 'Not Found',
    408 => 'Request Timeout',
    500 => 'Internal Server Error',
    502 => 'Bad Gateway',
    503 => 'Service Unavailable',
);

sub parse_req_meta {
    my $msg = shift;

    # TODO assert

    

    $log->error($DEBUG);
}

sub build_res_meta {
    my $status_code = shift;
    my %headers = %(shift) or {};
    my $body = shift or '';

    $log->error($DEBUG);

    # TODO asserts

    $result = "HTTP/1.1 $status_code $response_reason_phrases{$status_code}";

    foreach $field_name (keys $headers) {
        $result .= "\r\n$field_name: $headers{$field_name}";
    }

    $result .= "\r\n\r\n$body";

    return $result;
}

