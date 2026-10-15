# Development shells: `default` has every harness's tools, and each harness
# also gets its own, e.g. `nix develop .#yazi`.
{
  pkgs,
  bombadil,
  harnesses,
}:
let
  inherit (pkgs) lib;

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

    # Exports rather than attributes, because mkShell's inputsFrom carries
    # shellHooks over but not plain environment variables. The node_modules
    # link lets editors resolve the Bombadil types.
    shellHook = ''
      export BOMBADIL_NPM_PACKAGE="${bombadil.npm-package}"
      mkdir -p node_modules/@antithesishq
      ln -sfn "$BOMBADIL_NPM_PACKAGE" node_modules/@antithesishq/bombadil
    '';
  };

  shellWith = shells: pkgs.mkShell { inputsFrom = [ base ] ++ shells; };
in
{
  default = shellWith (lib.mapAttrsToList (_: h: h.devShell) harnesses);
}
// lib.mapAttrs (_: h: shellWith [ h.devShell ]) harnesses
