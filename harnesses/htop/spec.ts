// Bombadil specification for htop.
//
// htop runs in a PID namespace of its own, so nothing it does reaches
// bombadil. As PID 1 it handles SIGTERM, the kill menu's default, and
// quits, so the kill keys (k, F9) are left out, and random typing leaves
// out k and q. Nothing sends F10, which also quits.
import { weighted } from "@antithesishq/bombadil/terminal";
import {
  keys,
  pauseAfterEscape,
  resize,
  startsShowing,
  typePrintableExcept,
} from "../../lib/spec/common.ts";
export {
  exitSuccess,
  noReplacementChars,
} from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// Properties

// htop's header and process table are up.
export const startsUp = startsShowing(/PID|Load average/);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "\x1b[5~", "\x1b[6~", "\x1b[H",
  "\x1b[F", "\r", "\x1b", "\t", " ", "c", "U",
);

// Sorting, the tree view, threads, follow, views of one process (lsof,
// environment, IO) and the screen tabs.
const views = keys(
  "M", "P", "T", "I", "t", "+", "-", "*", "H", "K", "p", "F", "l", "e",
  "i", "w", "x", "Z", "z", "<", ">", ".",
  "\x1bOP", "\x1b[15~", "\x1b[17~", "\x1b[18~", // F1 help, F5 tree, F6 sort, F7 nice-
);

// The setup screen (F2) has many panels, lists and toggles of its own.
// Not F10: it leaves setup, but on the main screen it quits htop, which
// ended every run within seconds.
const setup = keys(
  "\x1bOQ", "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "\r", " ", "\x1b",
  "\x1b[15~", "\x1b[17~", "\x1b[18~", "\x1b[19~",
);

// Search (F3, /) and filter (F4, \), as whole sequences that open the
// field first, so letters aren't read as shortcuts.
const search = keys("/bash\r", "/zz\r", "\\bomb\r", "\\\x1b", "\x1bOR", "\x1bOS");

// Renicing the selected or tagged processes: nice up and down (F7, F8).
const signals = keys("\x1b[18~", "\x1b[19~", "]", "[");

export const drive = pauseAfterEscape(
  weighted([
    [30, navigate],
    [30, views],
    [15, setup],
    [10, search],
    [8, signals],
    [6, typePrintableExcept("kq")],
    [5, resize([20, 200], [5, 60])],
  ]),
);
