// Bombadil specification for k9s.
//
// k9s runs with --readonly, which disables shell, edit, delete, scale, etc.,
// so the fuzzer can't leave the TUI or change the cluster. The cluster holds
// the fixtures from cluster.yaml in the `fuzz` namespace.
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
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F", // page up/down, home, end
  "j", "k", "h", "l", "g", "G",
  "\r", "\x1b", "\t", "\x1b[Z",
);

// Views and toggles that don't mutate anything.
const viewKeys = keys(
  "?", "d", "y", "l", "p", "u", "w", "f", "c", "x", "s", "t",
  "0", "1", "2", "3", "4",
  "-", // back to the previous view
  "\x01", // Ctrl+A: aliases
  "\x05", // Ctrl+E: toggle header
  "\x17", // Ctrl+W: wide columns
  "\x1a", // Ctrl+Z: only faulty resources
  "\x13", // Ctrl+S: save the table to a file
);

// Sorting: Shift plus a column letter, and inverting the sort.
const sortKeys = keys("N", "A", "T", "R", "C", "M", "S", "I", "O", "P", "V");

const resources = [
  "pods", "deploy", "sts", "ds", "rs", "jobs", "cj", "svc", "ing", "ep",
  "cm", "secrets", "sa", "pvc", "pv", "sc", "ns", "no", "events", "hpa",
  "pdb", "netpol", "roles", "rb", "crb", "quota", "limits", "crd", "widgets",
  "ctx", "pulses", "xray deploy", "xray pods fuzz", "popeye", "bogus",
];

const command = keys(
  ...resources.map((r) => `:${r}\r`),
  // Namespaced and all-namespace variants.
  ...["pods", "deploy", "cm", "widgets", "events"].flatMap((r) => [
    `:${r} fuzz\r`,
    `:${r} all\r`,
    `:${r} -l app=web\r`,
  ]),
  ":ns fuzz\r", ":ctx kind-fuzz\r", ":\x1b",
);

const filter = keys(
  "/web\r", "/crash\r", "/ünïcödé\r", "/-l app=web\r", "/-l tier!=frontend\r",
  "/-f wbe\r", "/!system\r", "/[\r", "/\x1b",
);

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [20, viewKeys],
    [5, sortKeys],
    [15, command],
    [10, filter],
    [5, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [2, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
  ]),
);
