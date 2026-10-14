# Shared plumbing for harnesses.
#
# A harness describes how to launch one instance of its target, and picks one
# of two runners:
#
#   sandboxed  The whole campaign runs as a Nix build: no network, no access
#              to your home directory. Use it for anything that can run
#              commands or touch files, e.g. a file manager.
#   host       The campaign runs on your machine, for targets that need real
#              resources, e.g. a Kubernetes cluster. Isolate them with setup.
#
# Either way, `launch <run dir>` starts one target process and writes its
# stderr to <run dir>/stderr/<pid>, and also to the terminal so the spec can
# see crash messages. Both runners give the harness
#
#   apps.fuzz-<name>       run a campaign; arguments go to bombadil
#   apps.reproduce-<name>  replay a trace.jsonl(.zst) from a campaign
#
# and write results to .state/<name>/runs/<timestamp>/.
{ pkgs, bombadil }:
let
  inherit (pkgs) lib;

  bombadilBin = "${bombadil.default}/bin/bombadil";

  # Matches the lines that identify a crash in stderr: Rust panics, Go panics
  # and Go runtime fatal errors.
  defaultCrashLines = "panicked at |^panic: |^fatal error: ";

  # The spec of harness `name` together with the shared helpers it imports
  # from lib/spec, laid out as in the repository. Campaigns copy this tree
  # into their results as spec/, because replaying a trace needs the spec
  # it was recorded with.
  specTreeOf =
    name:
    lib.fileset.toSource {
      root = ../.;
      fileset = lib.fileset.unions [
        ./spec
        (../harnesses + "/${name}/spec.ts")
      ];
    };

  # finalize <run dir> <crash regex>: summarizes a finished campaign into
  # `violations` and `crashes`, and keeps zstd-compressed traces only for
  # runs that violated a property. A full campaign's traces run to hundreds
  # of gigabytes.
  finalize = pkgs.writeShellApplication {
    name = "zoo-finalize";
    runtimeInputs = with pkgs; [
      coreutils
      findutils
      gawk
      gnugrep
      gnused
      zstd
    ];
    text = ''
      out="$1"
      crash_lines="$2"

      find "$out/stderr" -type f -empty -delete 2>/dev/null || true

      # bombadil reprints its summary on every refresh, and lines look like
      # "noPanic: 3, 17". The worker table has numbers too, so match the
      # shape exactly and keep the last line per property.
      sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$out/bombadil.log" \
        | grep -E '^[A-Za-z]+: [0-9]+(, [0-9]+)*$' \
        | awk -F: '{ last[$1] = $0 } END { for (p in last) print last[p] }' \
        | sort > "$out/violations" || true
      # A replay (terminal test) reports "noPanic was violated" instead.
      grep -oE '^[A-Za-z]+ was violated' "$out/bombadil.log" \
        | sort -u >> "$out/violations" || true

      keep="$(cut -d: -f2 "$out/violations" | tr ',' '\n' | tr -d ' ' | sort -un)"
      for dir in "$out"/runs/*/; do
        [ -d "$dir" ] || continue
        if grep -qx "$(basename "$dir")" <<< "$keep"; then
          [ -f "$dir/trace.jsonl" ] && zstd -q --rm "$dir/trace.jsonl"
        else
          rm -rf "$dir"
        fi
      done

      # The distinct crash messages, most frequent first.
      cat "$out"/stderr/* 2>/dev/null \
        | grep -E "$crash_lines" \
        | sed -E 's/^thread .* panicked at /panicked at /' \
        | sort | uniq -c | sort -rn > "$out/crashes" || true
    '';
  };

  # report <run dir> <app name>: prints what a campaign found.
  report = pkgs.writeShellScript "zoo-report" ''
    out="$1"
    name="$2"
    # bombadil exits 0 when done and 2 on violations, but a replay (terminal
    # test) exits 1 for violations too, which it reports as such. Anything
    # else is a failure, e.g. a spec error or a trace the spec can't produce.
    status="$(${pkgs.coreutils}/bin/cat "$out/status")"
    if [ "$status" != 0 ] && [ "$status" != 2 ] \
      && ! ${pkgs.gnugrep}/bin/grep -q 'violation(s) reported' "$out/bombadil.log"; then
      echo "$name: bombadil failed with status $status:" >&2
      ${pkgs.gnused}/bin/sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$out/bombadil.log" \
        | ${pkgs.gnugrep}/bin/grep -v '^\s*$' | ${pkgs.coreutils}/bin/tail -3 >&2
    fi
    if [ -s "$out/violations" ]; then
      echo "$name: violated properties (and their run IDs):" >&2
      ${pkgs.coreutils}/bin/cat "$out/violations" >&2
    else
      echo "$name: no violations" >&2
    fi
    if [ -s "$out/crashes" ]; then
      echo "$name: crashes on stderr:" >&2
      ${pkgs.coreutils}/bin/cat "$out/crashes" >&2
    fi
    echo "$name: results in $out" >&2
  '';

  # Writes a trace given as trace.jsonl or trace.jsonl.zst to $2.
  unpackTrace = ''
    case "$1" in
      *.zst) ${pkgs.zstd}/bin/zstd -dcq "$1" > "$2" ;;
      *) ${pkgs.coreutils}/bin/cp "$1" "$2" ;;
    esac
  '';

  # Finds the repository, so apps work from any subdirectory.
  findRoot = ''
    root="$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)"
  '';

  app = drv: {
    type = "app";
    program = "${drv}/bin/${drv.name}";
  };
in
{
  inherit defaultCrashLines;

  # A harness whose campaigns run as Nix builds.
  #
  #   name               the harness directory under harnesses/
  #   launch             script: launch <run dir>
  #   inputs             extra tools on PATH during the campaign
  #   crashLines         regex for crash lines on stderr
  #   smokeArgs          bombadil arguments for the smoke check
  sandboxed =
    {
      name,
      launch,
      inputs ? [ ],
      crashLines ? defaultCrashLines,
      smokeArgs ? [
        "--time-limit-fuzz"
        "20s"
        "--time-limit-run"
        "5s"
      ],
    }:
    let
      specTree = specTreeOf name;
      specIn = tree: "${tree}/harnesses/${name}/spec.ts";
      env = ''
        export HOME="$TMPDIR/home"
        mkdir -p "$HOME" "$out/stderr"
      '';

      # One campaign. seed makes every invocation a distinct derivation. The
      # build succeeds whatever the campaign finds, so the results survive;
      # bombadil's own exit status is kept in `status`.
      run =
        {
          seed ? "0",
          args ? [ ],
        }:
        pkgs.runCommand "${name}-campaign-${seed}" { nativeBuildInputs = inputs; } ''
          ${env}
          status=0
          ${bombadilBin} terminal fuzz \
            --specification ${specIn specTree} \
            --output-path "$out" \
            ${lib.escapeShellArgs args} \
            -- ${launch} "$out" > "$out/bombadil.log" 2>&1 || status=$?
          echo "$status" > "$out/status"
          cp -r ${specTree} "$out/spec"
          ${finalize}/bin/zoo-finalize "$out" ${lib.escapeShellArg crashLines}
        '';

      # Replays a trace in the sandbox. Traces can contain anything the
      # fuzzer typed, so they never run on the host. specTree is the spec the
      # trace was recorded with, which may differ from the current one.
      reproduce =
        {
          trace,
          seed ? "0",
          specTree ? specTreeOf name,
        }:
        pkgs.runCommand "${name}-reproduce-${seed}" { nativeBuildInputs = inputs; } ''
          ${env}
          set -- ${trace} "$TMPDIR/trace.jsonl"
          ${unpackTrace}
          status=0
          ${bombadilBin} terminal test \
            --specification ${specIn specTree} \
            --reproduce "$TMPDIR/trace.jsonl" \
            --output-path "$out/run" \
            -- ${launch} "$out" > "$out/bombadil.log" 2>&1 || status=$?
          echo "$status" > "$out/status"
          ${finalize}/bin/zoo-finalize "$out" ${lib.escapeShellArg crashLines}
        '';

      # Builds a campaign or replay from the working tree's flake and copies
      # the result into .state. Plain nix from PATH on purpose: the client
      # should match the system's Nix daemon.
      build =
        kind: expr:
        pkgs.writeShellApplication {
          name = "${kind}-${name}";
          runtimeInputs = [
            pkgs.coreutils
            pkgs.jq
          ];
          text = ''
            ${findRoot}
            ts="$(date +%Y%m%d-%H%M%S)"
            dest="$root/.state/${name}/${if kind == "fuzz" then "runs" else "reproductions"}/$ts"
            flake="(builtins.getFlake \"git+file://$root\").legacyPackages.${pkgs.stdenv.hostPlatform.system}.campaigns.${name}"

            echo "${kind}-${name}: building in the Nix sandbox" >&2
            ${expr}

            mkdir -p "$dest"
            cp -r "$out"/. "$dest"
            chmod -R u+w "$dest"
            ${report} "$dest" "${kind}-${name}"
          '';
        };

      fuzz = build "fuzz" ''
        args="$(jq -nc '$ARGS.positional' --args -- "$@")"
        out="$(nix build --impure --no-link --print-out-paths -L \
          --argstr seed "$ts" --argstr args "$args" \
          --expr "{ seed, args }: $flake.run { inherit seed; args = builtins.fromJSON args; }")"
      '';

      reproduceApp = build "reproduce" ''
        if [ $# -ne 1 ]; then
          echo "usage: reproduce-${name} <trace.jsonl or trace.jsonl.zst>" >&2
          exit 1
        fi
        trace="$(realpath "$1")"
        # A trace lives at <campaign>/runs/<id>/; replay it with the spec
        # that campaign snapshotted, if it has one.
        snapshot="$(dirname "$(dirname "$(dirname "$trace")")")/spec"
        if [ -d "$snapshot" ]; then
          echo "reproduce-${name}: using the campaign's spec in $snapshot" >&2
        else
          echo "reproduce-${name}: no spec snapshot, using the current spec" >&2
          snapshot=""
        fi
        out="$(nix build --impure --no-link --print-out-paths -L \
          --argstr seed "$ts" --argstr trace "$trace" --argstr snapshot "$snapshot" \
          --expr "{ seed, trace, snapshot }: $flake.reproduce ({
            inherit seed;
            trace = builtins.path { path = trace; name = baseNameOf trace; };
          } // (if snapshot == \"\" then { } else {
            specTree = builtins.path { path = snapshot; name = \"spec\"; };
          }))")"
      '';

      # Proves the spec loads and the target starts in the sandbox. Fails only
      # if bombadil itself errors (status 1); violations are fine here.
      smoke = pkgs.runCommand "${name}-smoke" { } ''
        campaign=${
          run {
            seed = "smoke";
            args = smokeArgs;
          }
        }
        status="$(cat "$campaign/status")"
        if [ "$status" != 0 ] && [ "$status" != 2 ]; then
          echo "bombadil exited with $status:" >&2
          tail -20 "$campaign/bombadil.log" >&2
          exit 1
        fi
        touch "$out"
      '';
    in
    {
      apps = {
        "fuzz-${name}" = app fuzz;
        "reproduce-${name}" = app reproduceApp;
      };
      legacyPackages.campaigns.${name} = { inherit run reproduce; };
      checks."smoke-${name}" = smoke;
    };

  # A harness whose campaigns run on your machine.
  #
  #   name        the harness directory under harnesses/
  #   launch      script: launch <run dir>
  #   setup       shell run first in both apps, with $state set to
  #               .state/<name>; use it to isolate the target
  #   crashLines  regex for crash lines on stderr
  host =
    {
      name,
      launch,
      setup ? "",
      crashLines ? defaultCrashLines,
    }:
    let
      prelude = ''
        ${findRoot}
        state="$root/.state/${name}"
        mkdir -p "$state"
        ${setup}
        run="$state/$1/$(date +%Y%m%d-%H%M%S)"
        shift
        mkdir -p "$run/stderr"
      '';

      fuzz = pkgs.writeShellApplication {
        name = "fuzz-${name}";
        runtimeInputs = [ pkgs.coreutils ];
        text = ''
          set -- runs "$@"
          ${prelude}
          echo "fuzz-${name}: writing to $run" >&2
          # Replaying a trace needs the spec it was recorded with.
          mkdir -p "$run/spec/lib" "$run/spec/harnesses/${name}"
          cp -r "$root/lib/spec" "$run/spec/lib/spec"
          cp "$root/harnesses/${name}/spec.ts" "$run/spec/harnesses/${name}/spec.ts"
          status=0
          ${bombadilBin} terminal fuzz \
            --specification "$run/spec/harnesses/${name}/spec.ts" \
            --output-path "$run" \
            "$@" \
            -- ${launch} "$run" 2>&1 | tee "$run/bombadil.log" || status=$?
          echo "$status" > "$run/status"
          ${finalize}/bin/zoo-finalize "$run" ${lib.escapeShellArg crashLines}
          ${report} "$run" "fuzz-${name}"
        '';
      };

      reproduce = pkgs.writeShellApplication {
        name = "reproduce-${name}";
        runtimeInputs = [ pkgs.coreutils ];
        text = ''
          if [ $# -ne 1 ]; then
            echo "usage: reproduce-${name} <trace.jsonl or trace.jsonl.zst>" >&2
            exit 1
          fi
          trace="$(realpath "$1")"
          # A trace lives at <campaign>/runs/<id>/; replay it with the spec
          # that campaign snapshotted, if it has one.
          spec="$(dirname "$(dirname "$(dirname "$trace")")")/spec/harnesses/${name}/spec.ts"
          set -- reproductions
          ${prelude}
          if [ ! -f "$spec" ]; then
            echo "reproduce-${name}: no spec snapshot, using the current spec" >&2
            spec="$root/harnesses/${name}/spec.ts"
          fi
          set -- "$trace" "$run/input.jsonl"
          ${unpackTrace}
          status=0
          ${bombadilBin} terminal test \
            --specification "$spec" \
            --reproduce "$run/input.jsonl" \
            --output-path "$run/run" \
            -- ${launch} "$run" 2>&1 | tee "$run/bombadil.log" || status=$?
          echo "$status" > "$run/status"
          ${finalize}/bin/zoo-finalize "$run" ${lib.escapeShellArg crashLines}
          ${report} "$run" "reproduce-${name}"
        '';
      };
    in
    {
      apps = {
        "fuzz-${name}" = app fuzz;
        "reproduce-${name}" = app reproduce;
      };
    };

  # The shell part of a launch script: copies stderr to a file per process
  # under the run directory, and to the terminal.
  teeStderr = ''2> >(${pkgs.coreutils}/bin/tee "$1/stderr/$$" >&2)'';

  inherit specTreeOf;
}
