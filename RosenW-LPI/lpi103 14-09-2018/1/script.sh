#!/bin/bash
allLines=`cat ../res/access.log | wc -l`
lineCount=0
while read p; do
  if [[ $p =~ ^[a-Z0-9\.\-]+:[0-9]+" "[0-9\.]+" - - ["[0-9]+"/"[a-Z]+"/"[0-9\:]+" "[\+0-9]+"] "\"[^\"]+\"" "[0-9]+" "[0-9]+" "[0-9]+" "\"[^\"]+\"" "\"[^\"]+\"" - "[0-9]+" - "[0-9]+$ ]]; then
    ((lineCount++))
  fi
done <../res/access.log

cat ../res/access.log | grep -Po '^[A-z0-9\.\-\_]+:\d+ [0-9\.]+ - - [\[\]0-9A-z\/\:\s\+]+ "[^"]+" \d+ \d+ \d+ "[^"]+" "[^"]+" - \d+ - \d+$' | awk '{print $14}' | cut -d '"' -f2 | sort -n | uniq -c | sort -nr

echo "Valid line count: $lineCount"
echo "Invalid line count: $((allLines-lineCount))"
