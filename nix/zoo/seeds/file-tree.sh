mkdir -p "$out" && cd "$out"
mkdir -p docs/nested/deeper empty .hidden-dir many
for i in $(seq 1 40); do echo "file $i" > docs/file-$i.txt; done
echo "deep" > docs/nested/deeper/leaf.md
# Enough entries to scroll, sort and filter.
for i in $(seq 1 2000); do : > many/entry-$i; done

# Names: non-ASCII, wide characters, spaces, a leading dash, and a long
# one. Not control characters: file managers tend to show those as
# U+FFFD on purpose, which noReplacementChars would flag in every run.
printf 'héllo wörld\n' > "ünïcödé näme.txt"
printf '日本語\n' > "日本語のファイル.txt"
echo "spaces" > "name with  spaces.txt"
echo "dash" > ./-starts-with-dash
echo "long" > "$(printf 'x%.0s' $(seq 1 200)).txt"
echo "hidden" > .hidden-file

# Contents: binary, empty, executable, and things to preview.
head -c 1048576 /dev/zero > one-megabyte.bin
: > empty.txt
printf '#!/bin/sh\necho hi\n' > script.sh && chmod +x script.sh
printf '{"key": [1, 2, {"nested": true}]}\n' > data.json
for i in $(seq 1 500); do echo "line $i ─── ünïcödé $i"; done > long.txt

# Links: to a file, to a directory, dangling, and a loop.
ln -s docs/file-1.txt link-to-file
ln -s docs link-to-dir
ln -s nowhere dangling-link
ln -s self-loop self-loop
