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

  # A tree with the kinds of entries file managers trip over.
  seed = pkgs.runCommand "yazi-seed" { } ''
    mkdir -p $out && cd $out
    mkdir -p docs/nested/deeper empty .hidden-dir many
    for i in $(seq 1 40); do echo "file $i" > docs/file-$i.txt; done
    echo "deep" > docs/nested/deeper/leaf.md
    # Enough entries to scroll, sort and filter.
    for i in $(seq 1 2000); do : > many/entry-$i; done

    # Names: non-ASCII, wide characters, spaces, a leading dash, and a long
    # one. Not control characters: yazi shows those as U+FFFD on purpose,
    # which noReplacementChars would flag in every run.
    printf 'héllo wörld\n' > "ünïcödé näme.txt"
    printf '日本語\n' > "日本語のファイル.txt"
    echo "spaces" > "name with  spaces.txt"
    echo "dash" > ./-starts-with-dash
    echo "long" > "$(printf 'x%.0s' $(seq 1 200)).txt"
    echo "hidden" > .hidden-file

    # Contents: binary, empty, executable, and something to preview.
    head -c 1048576 /dev/zero > one-megabyte.bin
    : > empty.txt
    printf '#!/bin/sh\necho hi\n' > script.sh && chmod +x script.sh
    printf '{"key": [1, 2, {"nested": true}]}\n' > data.json

    # Links: to a file, to a directory, dangling, and a loop.
    ln -s docs/file-1.txt link-to-file
    ln -s docs link-to-dir
    ln -s nowhere dangling-link
    ln -s self-loop self-loop
  '';

  launch = zoo.launchInCopy {
    name = "yazi";
    inherit seed;
    command = "${yazi}/bin/yazi";
    # Entries a store path can't hold: a FIFO, which blocks anything that
    # reads it, and a directory yazi may not enter.
    prepare = ''
      ${pkgs.coreutils}/bin/mkfifo pipe
      mkdir locked && echo secret > locked/inside && chmod 000 locked
    '';
    env.EDITOR = "true";
  };
in
zoo.sandboxed {
  name = "yazi";
  inherit launch;
  inputs = with pkgs; [
    # MIME detection.
    file
    # Search (s, S) and the fzf jump (Z).
    fd
    ripgrep
    fzf
  ];
}
// {
  packages = {
    inherit yazi;
    yazi-upstream = pkgs.yazi;
    yazi-seed = seed;
  };

  devShell = pkgs.mkShell { packages = [ yazi ]; };
}
