# bombadil-zoo

Fuzz harnesses for terminal UIs, using [Bombadil](https://github.com/antithesishq/bombadil)'s
property-based terminal testing. Everything runs through Nix.

| Harness | Target | Runs |
| --- | --- | --- |
| [`k9s`](harnesses/k9s) | [k9s](https://github.com/derailed/k9s), against a throwaway kind cluster | on the host |
| [`lazygit`](harnesses/lazygit) | [lazygit](https://github.com/jesseduffield/lazygit), in a fresh seed repository | in the Nix sandbox |
| [`yazi`](harnesses/yazi) | [yazi](https://github.com/sxyazi/yazi), in a fresh seed directory tree | in the Nix sandbox |

## Running

```sh
nix run .#fuzz-yazi                                         # 5 minute campaign
nix run .#fuzz-yazi -- --time-limit-fuzz 30m --swarm        # arguments go to bombadil
nix run .#reproduce-yazi -- .state/yazi/runs/<ts>/runs/17/trace.jsonl.zst
nix flake check                                             # specs, builds, smoke campaigns
```

Every harness has `fuzz-<name>` and `reproduce-<name>`. Results go to
`.state/<name>/runs/<timestamp>/`:

```
status        bombadil's exit status
violations    violated properties and their run IDs
crashes       distinct crash messages from the target's stderr
runs/<id>/    trace.jsonl.zst, kept only for runs that violated a property
stderr/<pid>  the target's stderr, per process
spec/         the spec the campaign ran with, used by reproduce-<name>
```

A full campaign's traces run to hundreds of gigabytes, which is why only
failing runs keep theirs. Replays need the spec a trace was recorded with,
which is why every campaign keeps a copy.

`nix run .# -- <args>` runs Bombadil itself.

## Layout

```
flake.nix               collects every harness under harnesses/
lib/default.nix         the runners, trace pruning and reports
lib/spec/common.ts      helpers shared by the specs
harnesses/<name>/
  default.nix           how to build and launch the target
  spec.ts               properties and actions
  patches/              fixes carried while they're pending upstream
```

## Adding a harness

Create `harnesses/<name>/default.nix` and `harnesses/<name>/spec.ts`. The
flake picks up the directory automatically.

`default.nix` takes `{ pkgs, bombadil, zoo }`, writes a `launch` script that
starts one instance of the target, and hands it to a runner:

- `zoo.sandboxed { name, launch, inputs }` runs each campaign as a Nix
  build: no network and no access to your home directory. Use it for
  anything that can run commands or change files, e.g. a file manager's
  shell prompt or a git client.
- `zoo.host { name, launch, setup }` runs on your machine, for targets that
  need real resources, like k9s and its cluster. `setup` runs first with
  `$state` set to `.state/<name>`; use it to keep the target away from your
  real config.

`launch` is called as `launch <run dir>`. It should give every run a fresh
copy of any state the target changes, and send stderr to
`<run dir>/stderr/<pid>` and to the terminal with `${zoo.teeStderr}`, so the
spec sees crash messages on screen. Add `packages` for the target build and
a `devShell` with its tools by merging them into the runner's result.

`spec.ts` uses `lib/spec/common.ts`: `noCrashText` for the target's crash
messages, `neverStuckBlank`, `keys` and `resize` for actions, and
`pauseAfterEscape` around the action generator. Without that pause, an Esc
followed immediately by another key reads as Alt+key, which makes traces
replay differently from how they were recorded.

`nix develop` gives a shell with every harness's tools and links the
Bombadil types into `node_modules/` for editors; `nix develop .#<name>`
gives just one harness.
