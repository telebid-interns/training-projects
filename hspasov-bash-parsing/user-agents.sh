# awk '{ print $14 }' ../../../Downloads/access.log | sort | uniq -c | sort
if [ $# -eq 0 ]
  then
    echo "Expected argument file"
    exit 1
fi

all_rows_count=$(cat $1 | wc -l)
correct_rows_count=$(cat $1 | grep -E "^[^: ]+:[0-9]+ [a-zA-Z.0-9-]+ [^ ]+ [^ ]+ \[[^[]+\] \"[^\"]+\" [0-9]{3} [0-9]+ [0-9]+ \"[^\"]+\" \"[^\"]+\" - [0-9]+ - [0-9]+$" | wc -l)

echo $correct_rows_count
echo $all_rows_count
echo $((all_rows_count - correct_rows_count))

cat $1 | grep -E "^[^: ]+:[0-9]+ [a-zA-Z.0-9-]+ [^ ]+ [^ ]+ \[[^[]+\] \"[^\"]+\" [0-9]{3} [0-9]+ [0-9]+ \"[^\"]+\" \"[^\"]+\" - [0-9]+ - [0-9]+$" | cut -d"\"" -f6 | cut -d" " -f1 | sort | uniq -c | sort -nr
