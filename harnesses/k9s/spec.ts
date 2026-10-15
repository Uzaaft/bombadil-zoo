// Bombadil specification for k9s.
//
// k9s runs with --readonly, which disables shell, edit, delete, scale, etc.,
// so the fuzzer can't leave the TUI or change the cluster. The cluster holds
// the fixtures from cluster.yaml in the `fuzz` namespace.
import { always } from "@antithesishq/bombadil";
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
  screen,
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

// The header's first row, " Context: <name> [R] ...", or "" when the header
// is hidden (Ctrl+E) or another view fills the screen. Other rows can say
// "Context:" too, e.g. securityContext in YAML, so only row 0 counts.
function headerRow(): string {
  const row: string = (screen.current ?? "").split("\n")[0] ?? "";
  return row.startsWith(" Context: ") ? row : "";
}

// On narrow terminals, and for a frame while resizing, the k9s logo
// overlaps the header and clips it anywhere, e.g. "kind-fu ____". Clipped
// text proves nothing, so these properties only look at a header whose
// context is followed by a wide gap and then something other than the logo:
// there was room, so whatever is missing is really missing.
const unclipped = (name: string) =>
  new RegExp(`^ Context: ${name} {3,}[^_ ]`);

// k9s was started with --readonly and nothing may turn that off; the header
// marks a read-only context with [R], right after its name.
export const staysReadOnly = always(
  () => !unclipped("kind-fuzz").test(headerRow()),
);

// There is only one context, kind-fuzz, so switching contexts can't leave it.
export const staysOnFuzzContext = always(
  () => !unclipped("(?!kind-fuzz )[\\w.:@/-]+(?: \\[R\\])?").test(headerRow()),
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
  "?", "d", "y", "l", "p", "u", "w", "f", "c", "x", "s", "t", "v",
  "0", "1", "2", "3", "4",
  "-", // back to the previous view
  "[", "]", // command history back and forward
  "\x01", // Ctrl+A: aliases
  "\x05", // Ctrl+E: toggle header
  "\x17", // Ctrl+W: wide columns
  "\x1a", // Ctrl+Z: only faulty resources
  "\x13", // Ctrl+S: save the table to a file
  "\x12", // Ctrl+R: refresh
);

// Sorting: Shift plus a column letter, and inverting the sort.
const sortKeys = keys("N", "A", "T", "R", "C", "M", "S", "I", "O", "P", "V");

// Keys inside the log view: wrap, autoscroll, timestamps, fullscreen, time
// ranges, all containers, and saving.
const logKeys = keys(
  "w", "s", "t", "f", "a", "c", "0", "1", "2", "3", "4", "5", "6",
  "\x13", "\x0b", // Ctrl+S, Ctrl+K: clear
);

const resources = [
  "pods", "deploy", "sts", "ds", "rs", "jobs", "cj", "svc", "ing", "ep",
  "cm", "secrets", "sa", "pvc", "pv", "sc", "ns", "no", "events", "hpa",
  "pdb", "netpol", "roles", "rb", "crb", "quota", "limits", "crd", "widgets",
  "ctx", "pulses", "popeye", "aliases", "screendumps", "benchmarks", "bogus",
  "users", "groups", "can s:fuzz:robot", "help",
  ...["deploy", "sts", "ds", "svc fuzz", "pods fuzz", "cj", "jobs"].map(
    (r) => `xray ${r}`,
  ),
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

// Jump straight to a fixture and open one of its detail views, so describe,
// YAML and logs run on resources in different states.
const fixture = keys(
  ...["crashloop", "chatty", "pending", "web", "failing-job"].flatMap((p) =>
    ["d", "y", "l", "p"].map((k) => `:pods fuzz\r/${p}\r${k}`),
  ),
  ":cm fuzz\r/awkward\ry", ":secrets fuzz\rx", ":widgets\rd",
  ":cj fuzz\r\r", ":deploy fuzz\r\r",
);

const filter = keys(
  "/web\r", "/crash\r", "/ünïcödé\r", "/-l app=web\r", "/-l tier!=frontend\r",
  "/-f wbe\r", "/!system\r", "/[\r", "/\x1b",
);

export const drive = pauseAfterEscape(
  weighted([
    [30, navigate],
    [18, viewKeys],
    [5, sortKeys],
    [6, logKeys],
    [13, command],
    [8, fixture],
    [9, filter],
    [5, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [2, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
  ]),
);
