# Fuzz harness for superfile, the terminal file manager.
#
# superfile copies, moves, deletes, extracts and opens files, so campaigns
# run in the Nix sandbox. Every run starts it in a fresh copy of the shared
# file tree seed.
{
  pkgs,
  zoo,
  ...
}:
let
  # No update check, and missing config fields filled with defaults instead
  # of asking, so runs start in the file panel.
  config = pkgs.writeText "superfile-config.toml" ''
    auto_check_update = false
    ignore_missing_fields = true
    show_image_preview = false
  '';

  launch = zoo.launchInCopy {
    name = "superfile";
    seed = zoo.seeds.fileTree;
    prepare = zoo.seeds.fileTreePrepare;
    command = "${pkgs.superfile}/bin/superfile --config-file ${config} .";
    env = {
      HOME = ''"$work"'';
      XDG_CONFIG_HOME = ''"$work/.config"'';
      XDG_DATA_HOME = ''"$work/.local/share"'';
      XDG_STATE_HOME = ''"$work/.local/state"'';
      EDITOR = "true";
    };
  };
in
zoo.sandboxed {
  name = "superfile";
  inherit launch;
  inputs = with pkgs; [
    file
    gnutar
    gzip
    unzip
    zip
  ];
}
// {
  devShell = pkgs.mkShell { packages = [ pkgs.superfile ]; };
}
