# Fuzz harness for yazi, the terminal file manager.
#
# yazi's shell prompts run whatever is typed into them, so campaigns run in
# the Nix sandbox. Every run starts yazi in a fresh copy of a seed tree.
{
  pkgs,
  zoo,
  ...
}:
let
  # yazi with our fixes that are pending upstream, so fuzzing doesn't keep
  # rediscovering the same crashes.
  yazi = pkgs.yazi.override {
    yazi-unwrapped = pkgs.yazi-unwrapped.overrideAttrs (old: {
      patches = (old.patches or [ ]) ++ [
        ./patches/0001-input-op-range.patch
        ./patches/0002-input-kill-cursor.patch
      ];
    });
  };

  # A small tree with the kinds of entries file managers trip over.
  seed = pkgs.runCommand "yazi-seed" { } ''
    mkdir -p $out/docs/nested/deeper $out/empty $out/.hidden-dir
    for i in $(seq 1 40); do echo "file $i" > $out/docs/file-$i.txt; done
    echo "deep" > $out/docs/nested/deeper/leaf.md
    printf 'héllo wörld\n' > "$out/ünïcödé näme.txt"
    printf '日本語\n' > "$out/日本語のファイル.txt"
    echo "spaces" > "$out/name with  spaces.txt"
    echo "dash" > "$out/-starts-with-dash"
    echo "hidden" > $out/.hidden-file
    head -c 1048576 /dev/zero > $out/one-megabyte.bin
    printf '#!/bin/sh\necho hi\n' > $out/script.sh
    chmod +x $out/script.sh
    ln -s docs/file-1.txt $out/link-to-file
    ln -s nowhere $out/dangling-link
    ln -s docs $out/link-to-dir
  '';

  launch = pkgs.writeShellScript "yazi-launch" ''
    work="$(${pkgs.coreutils}/bin/mktemp -d)"
    ${pkgs.coreutils}/bin/cp -r ${seed}/. "$work"
    ${pkgs.coreutils}/bin/chmod -R u+w "$work"
    cd "$work"
    EDITOR=true exec ${yazi}/bin/yazi ${zoo.teeStderr}
  '';
in
zoo.sandboxed {
  name = "yazi";
  inherit launch;
  # yazi detects MIME types with file(1).
  inputs = [ pkgs.file ];
}
// {
  packages = {
    inherit yazi;
    yazi-upstream = pkgs.yazi;
    yazi-seed = seed;
  };

  devShell = pkgs.mkShell { packages = [ yazi ]; };
}
