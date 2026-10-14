# bombadil-zoo

Fuzz harnesses for terminal UIs, using [Bombadil](https://github.com/antithesishq/bombadil)'s
property-based terminal testing.

| Harness | Target | Run |
| --- | --- | --- |
| [`k9s`](harnesses/k9s) | [k9s](https://github.com/derailed/k9s), against a throwaway kind cluster | `nix run .#fuzz-k9s` |
| [`yazi`](harnesses/yazi) | [yazi](https://github.com/sxyazi/yazi), inside the Nix build sandbox | `nix run .#fuzz-yazi` |

Arguments after `--` go to `bombadil terminal fuzz`, e.g.
`nix run .#fuzz-k9s -- --time-limit-fuzz 30m --swarm`. Each campaign writes
to `.state/<harness>/runs/<timestamp>/`.

`nix run .# -- <args>` runs Bombadil itself, e.g. to replay a trace with
`terminal test --reproduce`.

## Layout

```
flake.nix                 collects every harness
harnesses/<name>/
  default.nix             { pkgs, bombadil } -> { packages, apps, devShell, legacyPackages? }
  spec.ts                 the Bombadil specification
  patches/                fixes applied to the target while they're pending upstream
```

Each harness keeps its target's state under `.state/<name>/`, never in your
home directory.

## Adding a harness

Create `harnesses/<name>/default.nix` returning:

- `packages`: the target build, e.g. patched or pinned.
- `apps.fuzz-<name>`: a script that sets up isolation and runs
  `bombadil terminal fuzz` with `harnesses/<name>/spec.ts`.
- `devShell`: extra tools for working on the harness.

The flake picks up every directory under `harnesses/` automatically.
`nix develop` gives a shell with all harnesses' tools; `nix develop .#<name>`
gives just one.

If the target can run arbitrary commands (e.g. a file manager's shell
prompt), run the campaign as a Nix build, like `harnesses/yazi`. The build
sandbox has no network and no access to your home directory. Keep only the
traces of failing runs: a full campaign's traces run to hundreds of gigabytes.
