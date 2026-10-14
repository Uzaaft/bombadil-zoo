# Fuzz harness for k9s, the Kubernetes TUI.
#
# k9s needs a cluster, so it runs on the host against a throwaway kind
# cluster, with all kube and k9s state under .state/k9s and --readonly so it
# can't change the cluster.
{
  pkgs,
  zoo,
  ...
}:
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

  launch = pkgs.writeShellScript "k9s-launch" ''
    exec ${k9s}/bin/k9s --readonly --logFile "$1/k9s.log" ${zoo.teeStderr}
  '';
in
zoo.host {
  name = "k9s";
  inherit launch;
  setup = ''
    ${isolate}
    # The cluster is throwaway. If its API server doesn't answer (e.g. the
    # node container stopped on reboot), recreate it rather than fuzz k9s
    # against a dead connection.
    if ! ${pkgs.kubectl}/bin/kubectl --request-timeout=5s get --raw /readyz >/dev/null 2>&1; then
      ${pkgs.kind}/bin/kind delete cluster --name fuzz >/dev/null 2>&1 || true
      ${pkgs.kind}/bin/kind create cluster --name fuzz
    fi
  '';
}
// {
  packages = {
    inherit k9s;
    k9s-upstream = pkgs.k9s;
  };

  devShell = pkgs.mkShell {
    packages = [
      k9s
      pkgs.kind
      pkgs.kubectl
    ];
    shellHook = ''
      state="$PWD/.state/k9s"
      ${isolate}
    '';
  };
}
