// Bombadil specification for atuin's interactive history search.
//
// The launch script restarts `atuin search -i` after every clean exit, so
// exitSuccess sees only exits that ended the loop, i.e. failures. Restarts
// cycle through the emacs, vim-insert and vim-normal keymaps and the
// inverted and compact layouts. Leaving atuin (Esc, Enter, Tab, Ctrl+C,
// Alt+1..9) only restarts it, so there are no quit keys to avoid.
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

// A result row is the indicator column, " > " on the selected row, then the
// duration and the time, e.g. "  >    0s    2y ago git ...". The inverted
// layout puts a border before it. Only one row can be selected; rows cut
// short by a narrow terminal don't match, which only weakens the check.
const selectedRow = /^[ │]{0,2} > +\d+\S* +\S+ ago /gm;

export const oneSelectedRow = always(
  () => (screen.current?.match(selectedRow) ?? []).length <= 1,
);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F",
  "\x10", "\x0e", "\x0a", "\x0b", // Ctrl+P, Ctrl+N, Ctrl+J, Ctrl+K
  "\x02", "\x06", // Ctrl+B, Ctrl+F
  "\x1b[1;5C", "\x1b[1;5D", // Ctrl+Right, Ctrl+Left
  "\x1bb", "\x1bf", // Alt+B, Alt+F
  "\x1b[<64;10;5M", "\x1b[<65;10;5M", // mouse wheel up, down
);

// Switching filter mode (Ctrl+R) and search mode (Ctrl+S), and redrawing
// (Ctrl+L).
const modes = keys("\x12", "\x13", "\x0c");

// Keys that leave atuin, which the launch script then restarts with the
// next setup: Esc, Tab, Enter, Ctrl+C, Ctrl+G and Alt+1..9. Kept rare, so
// each setup gets a few hundred keys. Ctrl+Y (copy) is left out: on an
// empty result list it panics (swap_remove on an empty Vec in
// interactive.rs), which ended most runs of a 20s campaign.
const leave = keys(
  "\x1b", "\t", "\r", "\x03", "\x07", "\x1b1", "\x1b3", "\x1b9",
);

// The Ctrl+A prefix: delete the entry, delete every entry with the same
// command, switch to its context and back, and the plain Ctrl+A.
const prefix = keys("\x01d", "\x01D", "\x01c", "\x01a", "\x01x", "\x01");

// The inspector (Ctrl+O) and its views: runs, session, stats and output,
// moving between entries, and deleting from it (Ctrl+D).
const inspector = keys(
  "\x0f", "r", "s", "t", "o", "\x04", "j", "k",
  "\x0fr", "\x0fs", "\x0ft", "\x0fo", "\x0f\x04",
);

// Vim normal mode, which Esc reaches from vim-insert: motions, the dd
// and gg sequences, deleting, changing and entering insert mode.
const vim = keys(
  "\x1b", "h", "l", "0", "$", "w", "b", "e", "x", "dd", "D", "C",
  "/", "?", "a", "A", "i", "I", "j", "k", "G", "gg", "H", "M", "L",
  "\x15", "\x04", "\x02", "\x06", // Ctrl+U/D/B/F
);

// Editing the query.
const editing = keys(
  "\x7f", "\x08", "\x17", "\x15", "\x05", // Backspace, Ctrl+H/W/U/E
  "\x1b[3~", "\x1b[3;5~", "\x1b\x7f", "\x1bd", // Delete, Ctrl/Alt word deletes
  "\x04", // Ctrl+D: deletes forward, or leaves atuin on an empty query
);

// Queries that match many, some or no entries, and atuin's query syntax.
// The host-9 and change 12 queries match a single entry, so deleting it
// empties the list.
const queries = keys(
  "git", "nix", "ünïcödé", "日本", "^cd", "build$", "!ls", "'exact",
  "xxxxxxxxxx", "-flag", "for f", "uptime; df", " ", "  ",
  "'host-9.", "^ssh host-9.", "change 12\"", "| grep", "!git !nix",
);

// Pasted text goes into the query as is, newlines and tabs included.
const paste = keys(
  ...[
    "git commit", "line one\nline two", "tab\there", "\r\n", "日本語のコマンド",
    "é‍\u{1f469}‍\u{1f4bb}", "x".repeat(400),
  ].map((text) => `\x1b[200~${text}\x1b[201~`),
);

export const drive = pauseAfterEscape(
  weighted([
    [20, navigate],
    [8, modes],
    [1, leave],
    [5, prefix],
    [6, inspector],
    [8, vim],
    [12, editing],
    [14, queries],
    [3, paste],
    [17, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [5, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
  ]),
);
