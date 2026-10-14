# Fuzz harness for k9s, the Kubernetes TUI.
#
# k9s needs a cluster, so the harness runs against a throwaway kind cluster
# and keeps all kube and k9s state under .state/k9s.
{ pkgs, bombadil }:
let
  # The tview version k9s 0.51.0 requires, with our fixes applied.
  tview = pkgs.applyPatches {
    name = "tview-patched";
    src = pkgs.fetchFromGitHub {
      owner = "derailed";
      repo = "tview";
      rev = "v0.8.5";
      hash = "sha256-16a/WQSfDWk7TdVyayu2GTIJ4S+ORtKqCNtk5JXMwUQ=";
    };
    patches = [ ./patches/tview/0001-textview-wrap-display-width.patch ];
  };

  # k9s with our fixes that are pending upstream or unreleased, so fuzzing
  # doesn't keep rediscovering the same crashes.
  k9s = pkgs.k9s.overrideAttrs (old: {
    patches = (old.patches or [ ]) ++ [
      ./patches/k9s/0001-xray-nil-root.patch
      ./patches/k9s/0002-cmdbuff-listener-race.patch
      ./patches/k9s/0003-table-no-api-version.patch
      ./patches/k9s/0004-xray-invalid-filter-rx.patch
      ./patches/k9s/0005-suggest-alias-race.patch
      ./patches/k9s/0006-xray-filter-before-load.patch
      ./patches/k9s/0007-recorder-send-on-closed.patch
      ./patches/k9s/0008-table-scheme-race.patch
    ];
    # Build against the patched tview. A directory replace doesn't change
    # the module set, so vendorHash stays the same.
    postPatch = (old.postPatch or "") + ''
      cp -r ${tview} ../tview
      chmod -R u+w ../tview
      echo 'replace github.com/derailed/tview => ../tview' >> go.mod
    '';
  });

  # Points kube and k9s at state under $state, so k9s can never reach a
  # real cluster or your own config.
  isolate = ''
    export KUBECONFIG="$state/kubeconfig"
    export K9S_CONFIG_DIR="$state/config"
    export XDG_STATE_HOME="$state/xdg"
    mkdir -p "$K9S_CONFIG_DIR" "$XDG_STATE_HOME"
  '';

  fuzz = pkgs.writeShellApplication {
    name = "fuzz-k9s";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gnugrep
    ];
    text = ''
      root="$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)"
      state="$root/.state/k9s"
      ${isolate}

      # The cluster is throwaway. If its API server doesn't answer (e.g. the
      # node container stopped on reboot), recreate it rather than fuzz k9s
      # against a dead connection.
      if ! ${pkgs.kubectl}/bin/kubectl --request-timeout=5s get --raw /readyz >/dev/null 2>&1; then
        ${pkgs.kind}/bin/kind delete cluster --name fuzz >/dev/null 2>&1 || true
        ${pkgs.kind}/bin/kind create cluster --name fuzz
      fi

      run="$state/runs/$(date +%Y%m%d-%H%M%S)"
      mkdir -p "$run"
      echo "fuzz-k9s: writing traces, k9s.log and stderr/ to $run" >&2

      # k9s draws on /dev/tty, so its stderr only carries Go crash output.
      # Keep one file per k9s process, since workers run in parallel, and
      # drop the empty ones afterwards.
      mkdir -p "$run/stderr"
      status=0
      # The inner script is single-quoted on purpose: $1 and $$ belong to
      # the bash that execs k9s.
      # shellcheck disable=SC2016
      ${bombadil.default}/bin/bombadil terminal fuzz \
        --specification "$root/harnesses/k9s/spec.ts" \
        --output-path "$run" \
        "$@" \
        -- ${pkgs.bash}/bin/bash -c \
        'exec ${k9s}/bin/k9s --readonly --logFile "$1/k9s.log" 2>"$1/stderr/$$"' \
        k9s "$run" || status=$?
      find "$run/stderr" -type f -empty -delete
      exit "$status"
    '';
  };
in
{
  packages = {
    inherit k9s;
    k9s-upstream = pkgs.k9s;
  };

  apps.fuzz-k9s = {
    type = "app";
    program = "${fuzz}/bin/fuzz-k9s";
  };

  devShell = pkgs.mkShell {
    packages = [
      k9s
      # A throwaway cluster for k9s to talk to.
      pkgs.kind
      pkgs.kubectl
    ];
    shellHook = ''
      state="$PWD/.state/k9s"
      ${isolate}
    '';
  };
}
