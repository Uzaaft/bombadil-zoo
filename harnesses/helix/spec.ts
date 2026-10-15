// Bombadil specification for Helix.
//
// Helix exits with a nonzero code on purpose (`:cq`), so this spec checks
// for panics and fatal signals instead of exitSuccess.
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

// A Rust panic prints "panicked at" before Helix exits.
export const noPanic = noCrashText(/panicked at/);

// The first file, src/main.c, is on screen.
export const startsUp = startsShowing(/#include <stdio\.h>/);

// Actions

const motions = keys(
  "h", "j", "k", "l", "w", "b", "e", "W", "B", "E", "f(", "t;", "F#", "T)",
  "gg", "ge", "gh", "gl", "gs", "gt", "gc", "gb", "gn", "gp", "%",
  "\x04", "\x15", "\x06", "\x02", // Ctrl+D/U/F/B
  "\x0f", "\x09", // Ctrl+O, Ctrl+I: jumplist
  "n", "N", "*", "]d", "[d", "]f", "[f", "]p", "[p",
);

// Selections are central to Helix: extend, split, select inside, keep.
const selections = keys(
  "x", "X", "v", ";", "\x1b;", ",", "C", "\x1bC", "s", "S", "K", "\x1bK",
  "mm", "mi(", "ma\"", "ms(", "md(", "mr([", "\x1bo", "\x1bi", "(", ")",
  "&", "_", "\x1b-", "\x1b_", "%",
);

const edits = keys(
  "d", "c", "y", "p", "P", "R", "u", "U", "\x1bu", "\x1bU", ".", "~", "`",
  "\x1b`", ">", "<", "=", "J", "\x1bJ", "r!", "\x01", "\x18", "Q", "q",
  "\"ay", "\"ap",
);

const insert = keys("i", "a", "I", "A", "o", "O", "\x0e", "\x10", "\x12\"");

// Pickers, spaces and commands, including ones that touch other files and
// the shell.
const commands = keys(
  " f", " b", " j", " s", " /", " ?", " w", " y", " p", "\x17s", "\x17v", "\x17w",
  "\x17q", "\x17o", "zz", "zt", "zb", "zj", "zk", "Z",
  ...[
    "sort", "reflow", "w", "w new.txt", "o data.json", "o long-lines.txt",
    "o blob.bin", "o crlf.txt", "buffer-close", "buffer-next", "vsplit", "hsplit",
    "set-language json", "set soft-wrap.enable true", "sh echo hi",
    "pipe sort", "insert-output echo hi", "reload", "tree-sitter-scopes",
    "log-open", "goto 50000", "earlier 5", "later 5", "theme base16_default",
  ].map((c) => `:${c}\r`),
  ":", "/", "?", "|", "!", "\x1b|", "\x1b!",
);

export const drive = pauseAfterEscape(
  weighted([
    [25, motions],
    [12, selections],
    [12, edits],
    [6, insert],
    [8, commands],
    [12, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [10, keys("\x1b")],
    [2, resize([20, 200], [5, 60])],
    [1, keys(":q!\r", ":qa!\r")],
  ]),
);
