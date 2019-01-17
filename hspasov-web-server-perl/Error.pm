use strict;
use warnings;
use diagnostics;

package Error;

sub new {
    my ($class, $msg, $origin) = @_;
    $origin //= {};

    my $self = {
        msg => $msg,
        origin => $origin,
    };

    bless($self, $class);
    return $self;
}

1;
