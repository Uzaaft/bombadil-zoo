// Bombadil specification for Neovim.
//
// Neovim exits with a nonzero code on purpose (`:cq`), so this spec checks
// for fatal signals and Neovim's own internal-error messages instead of
// exitSuccess.
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
export { noReplacementChars } from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// Properties

// Messages Neovim prints when its own invariants break, and what a crash
// prints before the process dies.
export const noInternalError = noCrashText(
  /E315: ml_get|E316: ml_get|E685: Internal error|Internal error:|Assertion .* failed|Vim: Caught deadly signal|nvim: .*ASSERT|E1500:/,
);

// The first file, src/main.c, is on screen.
export const startsUp = startsShowing(/#include <stdio\.h>/);

// Actions

const motions = keys(
  "h", "j", "k", "l", "w", "b", "e", "W", "B", "0", "$", "^",
  "gg", "G", "50%", "{", "}", "(", ")", "%", "f(", "t;", ";", ",",
  "\x04", "\x15", "\x06", "\x02", "\x05", "\x19", // Ctrl+D/U/F/B/E/Y scrolling
  "H", "M", "L", "zz", "zt", "zb", "*", "#", "n", "N",
);

// Changes in normal mode, with text objects and counts.
const edits = keys(
  "x", "X", "dd", "dw", "D", "cc", "ciw", "ci(", "das", "yy", "yiw", "p",
  "P", "u", "\x12", ".", "J", "gJ", ">>", "<<", "==", "~", "g~iw", "gUU",
  "3dd", "5x", "r!", "R", "\x01", "\x18", // Ctrl+A, Ctrl+X increment/decrement
  "ddp", "xp", "qaq", "qadwjq", "@a", "@@", "ma", "'a", "`a",
);

// Entering insert mode, with completion and register paste inside it.
const insert = keys(
  "i", "a", "o", "O", "I", "A", "s", "S", "C",
  "\x0e", "\x10", "\x12\"", "\x17", "\x15", // Ctrl+N/P completion, Ctrl+R ", Ctrl+W, Ctrl+U
);

// Visual modes and block operations.
const visual = keys("v", "V", "\x16", "gv", "o", "I", "A", "c", "d", "y", ">", "<", "u", "U");

// Windows, tabs, buffers and folds.
const windows = keys(
  "\x17s", "\x17v", "\x17w", "\x17q", "\x17o", "\x17=", "\x17_", "\x17|",
  "gt", "gT", "zf3j", "za", "zR", "zM", "zo", "zc", "zE",
);

// Ex commands, including ones that touch other files and the shell.
const ex = keys(
  ...[
    "%s/i/I/g", "g/text/d", "v/x/normal dd", "sort", "sort! n", "split",
    "vsplit", "tabnew", "tabclose", "bnext", "bprev", "bdelete", "edit data.json",
    "edit long-lines.txt", "edit blob.bin", "edit crlf.txt", "set wrap!",
    "set list!", "set number!", "set relativenumber!", "set ft=json",
    "syntax off", "syntax on", "help", "help motion", "undo 0", "earlier 10",
    "later 10", "normal! ggdG", "1,5d", "$put =range(1,50)", "%!sort",
    "r !echo hi", "terminal", "messages", "registers", "marks", "jumps",
    "changes", "ls", "w", "w! new.txt", "e!", "noh", "redraw!", "checkhealth",
  ].map((c) => `:${c}\r`),
  ":", "/", "?", "q:",
);

export const drive = pauseAfterEscape(
  weighted([
    [25, motions],
    [15, edits],
    [8, insert],
    [6, visual],
    [5, windows],
    [8, ex],
    [12, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [10, keys("\x1b")],
    [2, resize([20, 200], [5, 60])],
    [1, keys(":q!\r", ":qa!\r", "ZZ", "ZQ")],
  ]),
);
