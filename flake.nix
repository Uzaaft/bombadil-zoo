{
  description = "Property-based testing of the k9s TUI with Bombadil";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    # Deliberately not following our nixpkgs, so builds hit bombadil.cachix.org.
    bombadil.url = "github:antithesishq/bombadil";
  };

  nixConfig = {
    extra-substituters = [ "https://bombadil.cachix.org" ];
    extra-trusted-public-keys = [
      "bombadil.cachix.org-1:6L4epM9zwhEcAwouNgBa8ENtsgLNfedtQgqtdnQhZiM="
    ];
  };

  outputs =
    { nixpkgs, bombadil, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          let
            pkgs = nixpkgs.legacyPackages.${system};
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
          in
          f {
            inherit pkgs;
            bombadil = bombadil.packages.${system};
            # k9s with our fixes that are pending upstream or unreleased, so fuzzing
            # doesn't keep rediscovering the same crashes.
            k9s = pkgs.k9s.overrideAttrs (old: {
              patches = (old.patches or [ ]) ++ [
                ./patches/k9s/0001-xray-nil-root.patch
                ./patches/k9s/0002-cmdbuff-listener-race.patch
              ];
              # Build against the patched tview. A directory replace doesn't
              # change the module set, so vendorHash stays the same.
              postPatch = (old.postPatch or "") + ''
                cp -r ${tview} ../tview
                chmod -R u+w ../tview
                echo 'replace github.com/derailed/tview => ../tview' >> go.mod
              '';
            });
          }
        );
    in
    {
      packages = forAllSystems (
        {
          pkgs,
          bombadil,
          k9s,
        }:
        {
          bombadil = bombadil.default;
          # Type definitions / runtime for `@antithesishq/bombadil/terminal` specs.
          bombadil-npm = bombadil.npm-package;
          inherit k9s;
          k9s-upstream = pkgs.k9s;
          default = bombadil.default;
        }
      );

      apps = forAllSystems (
        {
          pkgs,
          bombadil,
          k9s,
        }:
        let
          fuzz = pkgs.writeShellApplication {
            name = "fuzz";
            runtimeInputs = [
              pkgs.coreutils
              pkgs.gnugrep
            ];
            text = ''
              root="$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)"
              state="$root/.state"

              # Keep k9s and kube state local to the repo so fuzzing can't
              # touch your real config or clusters.
              export KUBECONFIG="$state/kubeconfig"
              export K9S_CONFIG_DIR="$state/k9s"
              export XDG_STATE_HOME="$state/xdg"
              mkdir -p "$K9S_CONFIG_DIR" "$XDG_STATE_HOME"

              if ! ${pkgs.kind}/bin/kind get clusters 2>/dev/null | grep -qx fuzz; then
                ${pkgs.kind}/bin/kind create cluster --name fuzz
              fi

              run="$state/runs/$(date +%Y%m%d-%H%M%S)"
              mkdir -p "$run"
              echo "fuzz: writing traces and k9s.log to $run" >&2

              exec ${bombadil.default}/bin/bombadil terminal fuzz \
                --specification "$root/spec.ts" \
                --output-path "$run" \
                "$@" \
                -- ${k9s}/bin/k9s --readonly --logFile "$run/k9s.log"
            '';
          };
        in
        {
          default = {
            type = "app";
            program = "${bombadil.default}/bin/bombadil";
          };
          fuzz = {
            type = "app";
            program = "${fuzz}/bin/fuzz";
          };
        }
      );

      devShells = forAllSystems (
        {
          pkgs,
          bombadil,
          k9s,
        }:
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bombadil.default
              k9s

              # A throwaway cluster for k9s to talk to.
              kind
              kubectl

              # Writing specs.
              bun
              typescript
              typescript-language-server
              biome

              nil
              nixfmt
            ];

            BOMBADIL_NPM_PACKAGE = "${bombadil.npm-package}";

            shellHook = ''
              # Keep k9s and kube state local to the repo so fuzzing can't touch
              # your real config or clusters.
              export KUBECONFIG="$PWD/.state/kubeconfig"
              export K9S_CONFIG_DIR="$PWD/.state/k9s"
              export XDG_STATE_HOME="$PWD/.state/xdg"
              mkdir -p "$K9S_CONFIG_DIR" "$XDG_STATE_HOME"
            '';
          };
        }
      );

      formatter = forAllSystems ({ pkgs, ... }: pkgs.nixfmt);
    };
}
