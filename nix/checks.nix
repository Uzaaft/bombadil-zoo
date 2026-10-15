# Checks that aren't specific to one harness.
{ pkgs, bombadil }:
let
  inherit (pkgs) lib;
in
{
  # Type-checks the shared spec helpers and every harness's spec against the
  # Bombadil package's type definitions.
  specs =
    pkgs.runCommand "specs"
      {
        src = lib.fileset.toSource {
          root = ../.;
          fileset = lib.fileset.unions [
            ../tsconfig.json
            ../lib/spec
            (lib.fileset.fileFilter (f: f.name == "spec.ts") ../harnesses)
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
