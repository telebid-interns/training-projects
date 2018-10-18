#!/usr/bin/env bash
awk '{cpu += $8+$9; mem += $10; time += $11; parse_time += $12 count++} END { print cpu/count, mem/count, time/count, parse_time/count; }' $1
