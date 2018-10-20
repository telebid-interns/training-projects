#!/usr/bin/bash
awk '
{ cumtime[$6] += $4; count[$6]++; }
$1 ~ /\d*/ { calls[$6] += $1; }
END {
    for (ct in cumtime) {
        print cumtime[ct]/count[ct], calls[ct]/count[ct], ct;
    }
}' ${1:-./data/logs/profile.log} | sort -g | tail -n ${2-20}

grep 'in .* seconds' ${1:-./data/logs/profile.log} | awk '{ sum += $8; count ++ } END { print "Total time spent profiling:", sum/count; }'
