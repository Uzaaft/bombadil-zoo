// Bombadil specification for k9s.
//
// k9s runs with --readonly, which disables shell, edit, delete, scale, etc.,
// so the fuzzer can't leave the TUI or change the cluster.
import { weighted } from "@antithesishq/bombadil/terminal";
import {
  CharSets,
  typeFromSet,
} from "@antithesishq/bombadil/terminal/defaults/actions";
import {
  keys,
  noCrashText,
  pauseAfterEscape,
  resize,
} from "../../lib/spec/common.ts";
export {
  exitSuccess,
  noReplacementChars,
} from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank } from "../../lib/spec/common.ts";

// Properties

// k9s recovers panics in cmd/root.go, prints "Boom!!" and exits 0, so
// exitSuccess alone misses them. Unrecovered panics and runtime fatal errors
// print a trace.
export const noPanic = noCrashText(
  /Boom!!|panic: |fatal error: |goroutine \d+ \[/,
);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", // arrows
  "\x1b[5~", "\x1b[6~", // page up/down
  "j", "k", "g", "G",
  "\r", "\x1b", "\t",
);

// Views and toggles that don't mutate anything.
const viewKeys = keys(
  "?", "d", "y", "l", "u", "w", "f", "c", "x", "0", "1", "2",
  "\x01", // Ctrl+A: aliases
  "\x05", // Ctrl+E: toggle header
);

const command = keys(
  ...[
    "pods", "deploy", "svc", "ns", "no", "cm", "secrets", "events",
    "ctx", "pulses", "xray deploy", "crd", "sa", "pv", "pvc", "jobs",
    "bogus",
  ].map((c) => `:${c}\r`),
);

const filter = keys("/kube\r", "/core\r", "/-l app=x\r", "/!system\r", "/\x1b");

export const drive = pauseAfterEscape(
  weighted([
    [40, navigate],
    [20, viewKeys],
    [15, command],
    [10, filter],
    [5, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [2, resize([20, 200], [5, 60])],
  ]),
);
