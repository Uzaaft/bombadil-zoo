// Bombadil specification for yazi, the terminal file manager.
//
// Runs in the Nix sandbox, because yazi's shell prompts execute whatever
// gets typed into them.
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

// A Rust panic prints "panicked at" before yazi exits.
export const noPanic = noCrashText(/panicked at/);

// Actions

const navigate = keys(
  "h", "j", "k", "l",
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "gg", "G", "J", "K", "H", "L",
  "\r", "\x1b", "\t",
);

// Selection, clipboard and file operations. They only touch the run's
// scratch copy of the seed tree.
const fileOps = keys(
  " ", "v", "V", "\x01", // select, visual, visual unset, select all
  "y", "x", "p", "P", "Y", "X", // yank, cut, paste, paste overwrite, unyank
  "d", "D", "u", // trash, delete, undo
  "c", "cc", "cd", "cf", "cn", // copy path variants
  ".", // toggle hidden
);

// Keys that open a prompt. Whatever follows is typed into it.
const prompts = keys("a", "r", "/", "?", "f", ":", ";", "s", "S", "z", "Z");

// Editing keys inside a prompt, e.g. Ctrl+K kills to the end of line.
const promptEditing = keys(
  "\x0b", "\x15", "\x17", "\x08", "\x7f", // Ctrl+K, Ctrl+U, Ctrl+W, Ctrl+H, Backspace
  "\x1b[H", "\x1b[F", // Home, End
);

const tabs = keys("t", "1", "2", "3", "[", "]", "{", "}", "\x1b[Z");

const views = keys("~", "w", ",", "m", "'", "\x0c", "\x1b[5~", "\x1b[6~");

export const drive = pauseAfterEscape(
  weighted([
    [40, navigate],
    [20, fileOps],
    [10, prompts],
    [10, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [6, promptEditing],
    [8, tabs],
    [6, views],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q", "Q")],
  ]),
);
