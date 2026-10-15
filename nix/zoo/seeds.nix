# Seed data shared by harnesses. Pair a seed with zoo.launchInCopy.
{ pkgs }:
{
  # A directory tree with the kinds of entries file managers trip over.
  fileTree = pkgs.runCommand "file-tree-seed" { } (builtins.readFile ./seeds/file-tree.sh);

  # Shell for launchInCopy's prepare: entries a store path can't hold, a
  # FIFO, which blocks anything that reads it, and an unreadable directory.
  fileTreePrepare = ''
    ${pkgs.coreutils}/bin/mkfifo pipe
    mkdir locked && echo secret > locked/inside && chmod 000 locked
  '';
}
