# Seed data shared by harnesses. Pair a seed with zoo.launchInCopy.
{ pkgs }:
rec {
  # A directory tree with the kinds of entries file managers trip over.
  fileTree = pkgs.runCommand "file-tree-seed" { } (builtins.readFile ./seeds/file-tree.sh);

  # Shell for launchInCopy's prepare: entries a store path can't hold, a
  # FIFO, which blocks anything that reads it, and an unreadable directory.
  fileTreePrepare = ''
    ${pkgs.coreutils}/bin/mkfifo pipe
    mkdir locked && echo secret > locked/inside && chmod 000 locked
  '';

  # A global git config for seeds and targets: an identity, main as the
  # default branch, every directory safe, and file:// remotes allowed.
  gitconfig = pkgs.writeText "gitconfig" ''
    [user]
      name = Fuzz
      email = fuzz@example.invalid
    [init]
      defaultBranch = main
    [safe]
      directory = *
    [protocol "file"]
      allow = always
  '';

  # A git repository at repo/ with history to browse and state to act on,
  # and a bare copy at remote.git that it tracks as origin, so remote
  # operations do real work. Use it with GIT_CONFIG_GLOBAL = gitconfig.
  gitRepo = pkgs.runCommand "git-repo-seed" {
    nativeBuildInputs = [ pkgs.git ];
    GIT_CONFIG_GLOBAL = gitconfig;
  } (builtins.readFile ./seeds/git-repo.sh);

  # Source and text files of the kinds editors handle specially: several
  # languages, a 100,000 line file, very long lines, mixed indentation,
  # CRLF, a binary and an empty file.
  sourceFiles = pkgs.runCommand "source-files-seed" { } (builtins.readFile ./seeds/source-files.sh);
}
