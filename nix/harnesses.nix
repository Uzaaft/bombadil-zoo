# Imports every directory under harnesses/ and merges what they provide.
#
# A harness's default.nix takes { pkgs, bombadil, zoo } and returns packages,
# apps, a devShell and optionally checks and legacyPackages, mostly via
# zoo.sandboxed or zoo.host.
{
  pkgs,
  bombadil,
  zoo,
}:
let
  inherit (pkgs) lib;

  names = builtins.attrNames (
    lib.filterAttrs (_: type: type == "directory") (builtins.readDir ../harnesses)
  );

  harnesses = lib.genAttrs names (
    name: import (../harnesses + "/${name}") { inherit pkgs bombadil zoo; }
  );

  merge = attr: lib.concatMapAttrs (_: h: h.${attr} or { }) harnesses;
in
{
  inherit harnesses;
  packages = merge "packages";
  apps = merge "apps";
  checks = merge "checks";
  # Nested, e.g. campaigns.<name>, so merge recursively.
  legacyPackages = lib.foldl' lib.recursiveUpdate { } (
    lib.mapAttrsToList (_: h: h.legacyPackages or { }) harnesses
  );
}
