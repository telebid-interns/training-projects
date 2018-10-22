#!/usr/bin/env bash
awk '
$1 ~ /^[0-9]+$/ { cumtime[$6] += $4; count[$6]++; calls[$6] += $1; }
END {
    for (ct in cumtime) {
        printf "%f %s %s\n", cumtime[ct]/count[ct], calls[ct]/count[ct], ct;
    }
}' ${1:-./data/logs/profile.log} | sort -n | tail -n ${2:-20}
grep 'in .* seconds' ${1:-./data/logs/profile.log} | awk '{ sum += $8; count ++ } END { print "Total time spent profiling:", sum/count; }'
