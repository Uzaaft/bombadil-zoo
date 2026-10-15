// Bombadil specification for atuin's interactive history search.
//
// The launch script restarts `atuin search -i` after every clean exit, so
// exitSuccess sees only exits that ended the loop, i.e. failures.
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
  startsShowing,
} from "../../lib/spec/common.ts";
export {
  exitSuccess,
  noReplacementChars,
} from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// Properties

// A Rust panic prints "panicked at" before atuin exits.
export const noPanic = noCrashText(/panicked at/);

// The search lists the seeded history.
export const startsUp = startsShowing(/nix run|kubectl|cargo build|git commit/);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F",
  "\x10", "\x0e", // Ctrl+P, Ctrl+N
  "\x1b[1;5C", "\x1b[1;5D", // Ctrl+Right, Ctrl+Left
);

// Switching filter mode (Ctrl+R), search mode (Ctrl+S), the inspector
// (Ctrl+O), deleting from it, and the vim-style keymap toggles.
const modes = keys("\x12", "\x13", "\x0f", "\x04", "\x1b", "\t", "\r");

// Editing the query.
const editing = keys(
  "\x7f", "\x08", "\x17", "\x15", "\x0b", "\x01", "\x05", // Backspace, Ctrl+H/W/U/K/A/E
  "\x1b[3~", // Delete
);

// Queries that match many, some or no entries, and atuin's query syntax.
const queries = keys(
  "git", "nix", "ünïcödé", "日本", "^cd", "build$", "!ls", "'exact",
  "xxxxxxxxxx", "-flag", "for f", "uptime; df",
);

export const drive = pauseAfterEscape(
  weighted([
    [25, navigate],
    [10, modes],
    [15, editing],
    [15, queries],
    [20, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [5, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
  ]),
);
