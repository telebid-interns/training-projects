awk_script='{totime_percall += $3; cumtime_percall += $5; count++;} END {
print totime_percall / count, cumtime_percall / count, count;
}'
echo 'parse()' $(grep 'parser.py.*\(parse\)' $1 | awk "${awk_script}")
