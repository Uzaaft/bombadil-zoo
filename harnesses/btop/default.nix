# Fuzz harness for btop, the system monitor.
#
# btop can signal processes, so campaigns run in the Nix sandbox, where its
# PID namespace only holds the campaign's own processes. Its spec leaves the
# signal keys out, since those processes include bombadil.
{
  pkgs,
  zoo,
  ...
}:
let
  launch = zoo.launchInCopy {
    name = "btop";
    seed = pkgs.emptyDirectory;
    command = "${pkgs.btop}/bin/btop";
    prepare = "mkdir -p .config";
    env = {
      HOME = ''"$work"'';
      XDG_CONFIG_HOME = ''"$work/.config"'';
    };
  };
in
zoo.sandboxed {
  name = "btop";
  inherit launch;
}
// {
  devShell = pkgs.mkShell { packages = [ pkgs.btop ]; };
}
