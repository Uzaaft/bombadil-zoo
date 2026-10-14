# Fuzz harness for lazygit, the git TUI.
#
# lazygit runs git commands, custom shell commands (`:`) and can discard
# work, so campaigns run in the Nix sandbox. Every run starts lazygit in a
# fresh copy of a seed repository.
{
  pkgs,
  zoo,
  ...
}:
let
  git = "${pkgs.git}/bin/git";

  gitconfig = pkgs.writeText "gitconfig" ''
    [user]
      name = Fuzz
      email = fuzz@example.invalid
    [init]
      defaultBranch = main
    [safe]
      directory = *
  '';

  # No update checks or startup popups, so runs start in the main view.
  config = pkgs.writeText "lazygit.yml" ''
    update:
      method: never
    disableStartupPopups: true
    gui:
      showRandomTip: false
  '';

  # A repository with history to browse and state to act on: branches that
  # diverge, a tag, a stash, and staged, modified and untracked files.
  seed = pkgs.runCommand "lazygit-seed" { } ''
    export HOME=$TMPDIR GIT_CONFIG_GLOBAL=${gitconfig}
    mkdir -p $out && cd $out
    ${git} init -q
    for i in 1 2 3 4 5; do
      echo "line $i" >> notes.txt
      printf 'fn f%s() {}\n' "$i" > "src-$i.rs"
      ${git} add -A && ${git} commit -qm "commit $i"
    done
    ${git} tag v1
    ${git} checkout -qb feature
    echo "feature" >> notes.txt && ${git} commit -qam "feature work"
    printf 'ünïcödé\n' > "ünïcödé.txt" && ${git} add -A && ${git} commit -qm "add ünïcödé"
    ${git} checkout -q main
    echo "main diverges" >> notes.txt && ${git} commit -qam "diverge on main"
    echo "stashed" >> src-1.rs && ${git} stash -q
    echo "staged" >> src-2.rs && ${git} add src-2.rs
    echo "modified" >> src-3.rs
    echo "untracked" > untracked.txt
  '';

  launch = pkgs.writeShellScript "lazygit-launch" ''
    work="$(${pkgs.coreutils}/bin/mktemp -d)"
    ${pkgs.coreutils}/bin/cp -r ${seed}/. "$work"
    ${pkgs.coreutils}/bin/chmod -R u+w "$work"
    cd "$work"
    export GIT_CONFIG_GLOBAL=${gitconfig} XDG_CONFIG_HOME="$work/.config"
    export LG_CONFIG_FILE=${config} EDITOR=true
    exec ${pkgs.lazygit}/bin/lazygit ${zoo.teeStderr}
  '';
in
zoo.sandboxed {
  name = "lazygit";
  inherit launch;
  # lazygit runs git from PATH.
  inputs = [ pkgs.git ];
}
// {
  packages.lazygit-seed = seed;

  devShell = pkgs.mkShell { packages = [ pkgs.lazygit ]; };
}
