# Fuzz harness for yazi, the terminal file manager.
#
# yazi can run arbitrary shell commands from its prompts, so a campaign runs
# as a Nix build: no network, no access to your home directory, its own PID
# and mount namespaces. Every run starts yazi in a fresh copy of a seed tree.
{ pkgs, bombadil }:
let
  inherit (pkgs) lib;

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

  # Runs one yazi instance in a fresh copy of the seed tree. yazi draws on
  # /dev/tty, so stderr only carries panics and shell command errors. It's
  # copied to a file per process, since workers run in parallel, and still
  # reaches the terminal, so the spec sees a panic and the run is kept.
  launch = pkgs.writeShellScript "yazi-launch" ''
    work="$(${pkgs.coreutils}/bin/mktemp -d)"
    ${pkgs.coreutils}/bin/cp -r ${seed}/. "$work"
    ${pkgs.coreutils}/bin/chmod -R u+w "$work"
    cd "$work"
    exec ${pkgs.yazi}/bin/yazi 2> >(${pkgs.coreutils}/bin/tee "$1/stderr/$$" >&2)
  '';

  # One campaign. seed makes every invocation a distinct derivation, and
  # args are passed through to bombadil. The build always succeeds, so the
  # output survives a failing campaign. Only the runs that violated a
  # property keep their traces, since a full campaign's traces run to
  # hundreds of gigabytes.
  campaign =
    {
      seed ? "0",
      args ? [ ],
    }:
    pkgs.runCommand "yazi-campaign-${seed}"
      {
        nativeBuildInputs = [
          pkgs.file
          pkgs.zstd
        ];
      }
      ''
        export HOME=$TMPDIR/home EDITOR=true
        mkdir -p $HOME $out/stderr

        status=0
        ${bombadil.default}/bin/bombadil terminal fuzz \
          --specification ${./spec.ts} \
          --output-path $out \
          ${lib.escapeShellArgs args} \
          -- ${launch} $out > $out/bombadil.log 2>&1 || status=$?
        echo "$status" > $out/status

        find $out/stderr -type f -empty -delete

        # Keep traces only for runs listed under a violated property.
        # Those lines look like "noPanic: 3, 17"; the worker table that
        # follows them has numbers too, so match the shape exactly.
        keep=$(sed 's/\x1b\[[0-9;]*[A-Za-z]//g' $out/bombadil.log \
          | sed -n '/^Violated properties/,$p' \
          | grep -E '^[A-Za-z]+: [0-9]+(, [0-9]+)*$' \
          | cut -d: -f2 | tr ',' '\n' | tr -d ' ' | sort -un || true)
        for dir in $out/runs/*/; do
          id=$(basename "$dir")
          if echo "$keep" | grep -qx "$id"; then
            zstd -q --rm "$dir/trace.jsonl"
          else
            rm -rf "$dir"
          fi
        done
      '';

  fuzz = pkgs.writeShellApplication {
    name = "fuzz-yazi";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gawk
      pkgs.gnugrep
      pkgs.gnused
    ];
    text = ''
      root="$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)"
      ts="$(date +%Y%m%d-%H%M%S)"
      dest="$root/.state/yazi/runs/$ts"
      args="$(${pkgs.jq}/bin/jq -nc '$ARGS.positional' --args -- "$@")"

      echo "fuzz-yazi: building campaign $ts in the Nix sandbox" >&2
      # Plain nix from PATH on purpose: the client should match the
      # system's Nix daemon.
      out="$(nix build --impure --no-link --print-out-paths -L \
        --argstr seed "$ts" --argstr args "$args" \
        --expr "{ seed, args }: (builtins.getFlake \"git+file://$root\")
          .legacyPackages.${pkgs.stdenv.hostPlatform.system}.campaigns.yazi
          { inherit seed; args = builtins.fromJSON args; }")"

      mkdir -p "$dest"
      cp -r "$out"/. "$dest"
      chmod -R u+w "$dest"

      # bombadil reprints its summary on every refresh, so keep the last
      # line for each property.
      summary="$(sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$dest/bombadil.log" \
        | grep -E '^[A-Za-z]+: [0-9]+(, [0-9]+)*$' \
        | awk -F: '{ last[$1] = $0 } END { for (p in last) print last[p] }' || true)"
      if [ -n "$summary" ]; then
        echo "fuzz-yazi: violated properties (and their run IDs):" >&2
        echo "$summary" >&2
        grep -h "panicked at" "$dest"/stderr/* 2>/dev/null \
          | sed 's/.*panicked at //' | sort | uniq -c >&2 || true
      else
        echo "fuzz-yazi: no violations" >&2
      fi
      echo "fuzz-yazi: results in $dest" >&2
    '';
  };
in
{
  packages.yazi-seed = seed;

  legacyPackages.campaigns.yazi = campaign;

  apps.fuzz-yazi = {
    type = "app";
    program = "${fuzz}/bin/fuzz-yazi";
  };

  devShell = pkgs.mkShell {
    packages = [ pkgs.yazi ];
  };
}
