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
      # Every directory under harnesses/ is a harness. Its default.nix takes
      # { pkgs, bombadil, zoo } and returns packages, apps, a devShell and
      # optionally checks and legacyPackages, mostly via zoo.sandboxed or
      # zoo.host from lib/.
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
            zoo = import ./lib {
              inherit pkgs;
              bombadil = bombadil';
            };
          in
          f {
            inherit pkgs zoo;
            bombadil = bombadil';
            harnesses = lib.genAttrs harnessNames (
              name:
              import ./harnesses/${name} {
                inherit pkgs zoo;
                bombadil = bombadil';
              }
            );
          }
        );

      merge = attr: harnesses: lib.concatMapAttrs (_: h: h.${attr} or { }) harnesses;
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
        // merge "packages" harnesses
      );

      # Things that can't be packages, e.g. the functions that build a
      # campaign derivation per invocation.
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
        // merge "apps" harnesses
      );

      # nix flake check: type-checks every spec, builds every harness's
      # packages, and runs a short smoke campaign for sandboxed harnesses.
      checks = forAllSystems (
        {
          pkgs,
          bombadil,
          harnesses,
          ...
        }:
        {
          specs =
            pkgs.runCommand "specs"
              {
                src = lib.fileset.toSource {
                  root = ./.;
                  fileset = lib.fileset.unions [
                    ./tsconfig.json
                    ./lib/spec
                    (lib.fileset.fileFilter (f: f.name == "spec.ts") ./harnesses)
                  ];
                };
              }
              ''
                cp -r $src/. . && chmod -R u+w .
                mkdir -p node_modules/@antithesishq
                ln -s ${bombadil.npm-package} node_modules/@antithesishq/bombadil
                ${pkgs.typescript}/bin/tsc -p tsconfig.json
                touch $out
              '';
        }
        // merge "packages" harnesses
        // merge "checks" harnesses
      );

      devShells = forAllSystems (
        {
          pkgs,
          bombadil,
          harnesses,
          ...
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

            # Exports rather than attributes, because mkShell's inputsFrom
            # carries shellHooks over but not plain environment variables.
            # The node_modules link lets editors resolve the bombadil types.
            shellHook = ''
              export BOMBADIL_NPM_PACKAGE="${bombadil.npm-package}"
              mkdir -p node_modules/@antithesishq
              ln -sfn "$BOMBADIL_NPM_PACKAGE" node_modules/@antithesishq/bombadil
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
