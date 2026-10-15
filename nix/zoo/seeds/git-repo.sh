# Expects git on PATH and GIT_CONFIG_GLOBAL set.
export HOME=$TMPDIR
mkdir -p "$out/repo" && cd "$out/repo"
git init -q

# Enough history to scroll, with a long message and non-ASCII text.
for i in $(seq 1 30); do
  echo "line $i" >> notes.txt
  printf 'fn f%s() {}\n' "$i" > "src-$((i % 5)).rs"
  git add -A && git commit -qm "commit $i"
done
printf 'ünïcödé\n' > "ünïcödé.txt"
for i in $(seq 0 255); do printf "\\$(printf %03o "$i")"; done > blob.bin
git add -A && git commit -qm "add a binary and ünïcödé" \
  -m "$(printf 'A body with several lines.\n\n- one\n- two\n\n%.0s' 1 2 3)"
git mv src-1.rs renamed.rs && git commit -qm "rename src-1"
git tag v1
git tag -a v1-annotated -m "an annotated tag"

# A feature branch, merged back with a merge commit, and one that
# diverges from main.
git checkout -qb feature
echo "feature" >> notes.txt && git commit -qam "feature work"
git checkout -q main
echo "main" > main-only.txt && git add -A && git commit -qm "main work"
git merge -q --no-ff feature -m "merge feature"
git checkout -qb diverged HEAD~3
echo "diverged" >> notes.txt && git commit -qam "diverged work"
# Changes the same line as main, so merging or rebasing onto it stops
# in a conflict and lazygit's conflict view has something to resolve.
git checkout -qb conflicting main
sed -i '1s/.*/conflicting first line/' notes.txt
git commit -qam "conflict with main"
git checkout -q main
sed -i '1s/.*/main first line/' notes.txt
git commit -qam "change the first line on main"

# A long file, committed, then edited in several far-apart places below,
# so the staging view has separate hunks and lines to pick.
seq 1 200 | sed 's/^/row /' > long.txt
git add long.txt && git commit -qm "add long.txt"

# A submodule, with its own history.
git init -q --bare "$out/sub.git"
git clone -q "$out/sub.git" "$TMPDIR/sub"
(cd "$TMPDIR/sub" && echo "sub" > sub.txt && git add -A \
  && git commit -qm "sub commit" && git push -q origin HEAD:main)
git submodule add -q "$out/sub.git" sub
git commit -qm "add a submodule"

git clone -q --bare . ../remote.git
git remote add origin ../remote.git
git fetch -q origin
git branch -q --set-upstream-to origin/main
# One local commit ahead of the remote.
echo "unpushed" >> notes.txt && git commit -qam "unpushed work"

# Working tree state: a stash, and staged, modified and untracked files.
echo "stashed" >> src-2.rs && git stash -q
echo "staged" >> src-3.rs && git add src-3.rs
echo "modified" >> src-4.rs
sed -i -e '10s/$/ edited/' -e '90s/.*/row 90 replaced/' -e '150d' -e '199a row new' long.txt
echo "untracked" > untracked.txt
