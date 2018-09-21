#!/bin/bash
allLines=`cat ../res/access.log | wc -l`
lineCount=0
while read p; do
  if [[ $p =~ ^[a-Z0-9\.\-]+:[0-9]+" "[0-9\.]+" - - ["[0-9]+"/"[a-Z]+"/"[0-9\:]+" "[\+0-9]+"] "\"[^\"]+\"" "[0-9]+" "[0-9]+" "[0-9]+" "\"[^\"]+\"" "\"[^\"]+\"" - "[0-9]+" - "[0-9]+$ ]]; then
    ((lineCount++))
  fi
done <../res/access.log

cat ../res/access.log | grep -Po '\[.*\] .* /.* - [0-9]+ - [0-9]+' | grep -Po ' /.*' | awk -F '".*"' '{print $1 $2}' | awk -F ' ' '{print $1 " " $4}' | awk -F '[\.\?].* ' '{print $1 " " $2}' | awk '$2>5000000' | sort -nr | awk -F ' ' '{print $1}' | uniq -c | sort -nr

echo "Valid line count: $lineCount"
echo "Invalid line count: $((allLines-lineCount))"
