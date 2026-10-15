# Fuzz harness for htop, the process viewer.
#
# htop can signal and renice processes, so campaigns run in the Nix
# sandbox, and htop gets a PID namespace of its own inside it.
{
  pkgs,
  zoo,
  ...
}:
let
  launch = zoo.launchInCopy {
    name = "htop";
    seed = pkgs.emptyDirectory;
    prepare = "mkdir -p .config";
    # A PID namespace of its own, where htop is PID 1 and only sees itself,
    # so its kill keys can't reach bombadil.
    command = "${pkgs.util-linux}/bin/unshare --user --pid --fork --mount-proc ${pkgs.htop}/bin/htop";
    env = {
      HOME = ''"$work"'';
      XDG_CONFIG_HOME = ''"$work/.config"'';
    };
  };
in
zoo.sandboxed {
  name = "htop";
  inherit launch;
}
// {
  devShell = pkgs.mkShell { packages = [ pkgs.htop ]; };
}
