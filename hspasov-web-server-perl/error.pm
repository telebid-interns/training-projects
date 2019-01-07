use strict;
use warnings;
use diagnostics;

package Error;

sub new {
    my $class = shift;
    my $msg = shift;
    my $origin = shift;

    my $self = {
        msg => $msg,
        origin => $origin,
    };

    bless($self, $class);
    return $self;
}

1;
