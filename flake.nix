{
  description = "Property-based fuzzing of terminal UIs with Bombadil";

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
      inherit (nixpkgs) lib;
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      # Every directory under harnesses/ is a harness. Each one's default.nix
      # takes { pkgs, bombadil } and returns { packages, apps, devShell } and
      # optionally legacyPackages.
      harnessNames = builtins.attrNames (
        lib.filterAttrs (_: type: type == "directory") (builtins.readDir ./harnesses)
      );
      forAllSystems =
        f:
        lib.genAttrs systems (
          system:
          let
            pkgs = nixpkgs.legacyPackages.${system};
            bombadil' = bombadil.packages.${system};
          in
          f {
            inherit pkgs;
            bombadil = bombadil';
            harnesses = lib.genAttrs harnessNames (
              name:
              import ./harnesses/${name} {
                inherit pkgs;
                bombadil = bombadil';
              }
            );
          }
        );
    in
    {
      packages = forAllSystems (
        { bombadil, harnesses, ... }:
        {
          bombadil = bombadil.default;
          # Type definitions / runtime for `@antithesishq/bombadil/terminal` specs.
          bombadil-npm = bombadil.npm-package;
          default = bombadil.default;
        }
        // lib.concatMapAttrs (_: h: h.packages) harnesses
      );

      # Things that can't be packages, e.g. functions that build a campaign
      # derivation per invocation.
      legacyPackages = forAllSystems (
        { harnesses, ... }:
        lib.foldl' lib.recursiveUpdate { } (lib.mapAttrsToList (_: h: h.legacyPackages or { }) harnesses)
      );

      apps = forAllSystems (
        { bombadil, harnesses, ... }:
        {
          default = {
            type = "app";
            program = "${bombadil.default}/bin/bombadil";
          };
        }
        // lib.concatMapAttrs (_: h: h.apps) harnesses
      );

      devShells = forAllSystems (
        {
          pkgs,
          bombadil,
          harnesses,
        }:
        let
          base = pkgs.mkShell {
            packages = with pkgs; [
              bombadil.default

              # Writing specs.
              bun
              typescript
              typescript-language-server
              biome

              nil
              nixfmt
            ];

            # An export rather than an attribute, because mkShell's inputsFrom
            # carries shellHooks over but not plain environment variables.
            shellHook = ''
              export BOMBADIL_NPM_PACKAGE="${bombadil.npm-package}"
            '';
          };
        in
        {
          # Everything, for working across harnesses.
          default = pkgs.mkShell {
            inputsFrom = [ base ] ++ lib.mapAttrsToList (_: h: h.devShell) harnesses;
          };
        }
        // lib.mapAttrs (
          _: h:
          pkgs.mkShell {
            inputsFrom = [
              base
              h.devShell
            ];
          }
        ) harnesses
      );

      formatter = forAllSystems ({ pkgs, ... }: pkgs.nixfmt);
    };
}
