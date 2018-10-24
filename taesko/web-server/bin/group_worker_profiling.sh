#!/usr/bin/env bash
awk '
$2 ~ /^[0-9.]+$/ { cumtime[$6] += $4; tottime[$6] += $2; count[$6]++; calls[$6] += $1; }
END {
    for (ct in cumtime) {
        printf "%f %f %s %s\n", cumtime[ct]/count[ct], tottime[ct]/count[ct], calls[ct]/count[ct], ct;
    }
}' ${1:-./data/logs/profile.log} | sort -k ${3:-1} | tail -n ${2:-20}
grep 'in .* seconds' ${1:-./data/logs/profile.log} | awk '{ sum += $8; count ++ } END { print "Average time spent profiling:", sum/count; }'
grep 'custom worker_time -' ${1:-./data/logs/profile.log} | awk '{ sum += $6; count++ } END { print "Average worker time:", sum/count; }'
