# Fuzz harness for atuin's interactive history search (`atuin search -i`).
#
# The seed is a history database imported from a generated zsh history.
# atuin can run commands from the history it shows, so campaigns run in the
# Nix sandbox. Every run starts on a fresh copy of the database.
{
  pkgs,
  zoo,
  ...
}:
let
  atuin = "${pkgs.atuin}/bin/atuin";

  # No sync, no update check and no daemon: everything stays local.
  config = pkgs.writeText "atuin-config.toml" ''
    auto_sync = false
    update_check = false
    sync_address = "http://127.0.0.1:9"
    enter_accept = false
    [daemon]
    enabled = false
  '';

  # Commands of every shape the search UI has to render and filter: short
  # and long, multi-line, non-ASCII, wide characters, duplicates, failures.
  seed = pkgs.runCommand "atuin-seed" { } ''
    export HOME=$TMPDIR/home XDG_DATA_HOME=$out/data XDG_CONFIG_HOME=$out/config
    mkdir -p $HOME $XDG_CONFIG_HOME/atuin $XDG_DATA_HOME
    cp ${config} $XDG_CONFIG_HOME/atuin/config.toml

    history=$TMPDIR/zsh_history
    t=1700000000
    add() { t=$((t + 37)); printf ': %s:%s;%s\n' "$t" "$1" "$2" >> $history; }
    for i in $(seq 1 3000); do
      case $((i % 12)) in
        0) add 0 "git commit -m \"change $i\"" ;;
        1) add 2 "cargo build --release --features feature-$i" ;;
        2) add 0 "cd ~/projects/ünïcödé-$i" ;;
        3) add 1 "echo 日本語のコマンド $i" ;;
        4) add 0 "kubectl get pods -n fuzz -o wide | grep web-$i" ;;
        5) add 0 "ls" ;;
        6) add 0 "$(printf 'x%.0s' $(seq 1 300)) $i" ;;
        7) add 127 "nonexistent-command-$i --flag" ;;
        8) add 0 "for f in *.txt; do\\
      echo \"\$f\" $i\\
    done" ;;
        9) add 0 "ssh host-$i.example.com 'uptime; df -h'" ;;
        10) add 0 "nix run .#fuzz-yazi -- --time-limit-fuzz 10m" ;;
        11) add 0 "   leading and trailing spaces $i   " ;;
      esac
    done
    HISTFILE=$history ${atuin} import zsh
  '';

  # atuin exits after every selection or Esc. Restart it while it exits
  # cleanly, so a run keeps fuzzing; any other exit ends the run, so the
  # spec still sees crashes.
  search = pkgs.writeShellScript "atuin-search-loop" ''
    # Keys that arrive between two instances would otherwise be echoed by
    # the terminal, and a multi-byte character split across reads shows up
    # as U+FFFD, which noReplacementChars flagged.
    ${pkgs.coreutils}/bin/stty -echo
    while ${atuin} search -i; do :; done
  '';

  launch = zoo.launchInCopy {
    name = "atuin";
    inherit seed;
    command = "${search}";
    env = {
      HOME = ''"$work"'';
      XDG_DATA_HOME = ''"$work/data"'';
      XDG_CONFIG_HOME = ''"$work/config"'';
      ATUIN_SESSION = "0192d2e0a4a07c3a9c1e5e5f5b5c5d5e";
    };
  };
in
zoo.sandboxed {
  name = "atuin";
  inherit launch;
}
// {
  packages.atuin-seed = seed;

  devShell = pkgs.mkShell { packages = [ pkgs.atuin ]; };
}
