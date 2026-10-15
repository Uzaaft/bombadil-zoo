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
  "gg", "G", "J", "K", "H", "L", "\x1b[5~", "\x1b[6~",
  "gh", "gc", "gd", "g ", // go home, to config, to downloads, interactively
  "\r", "\x1b", "\t",
);

// Selection, clipboard and file operations. They only touch the run's
// scratch copy of the seed tree.
const fileOps = keys(
  " ", "v", "V", "\x01", "\x12", // select, visual, unset visual, all, invert
  "y", "x", "p", "P", "Y", "X", // yank, cut, paste, paste overwrite, unyank
  "-", "_", // symlink, relative symlink
  "d", "D", "u", // trash, delete, undo
  "c", "cc", "cd", "cf", "cn", // copy path variants
  "o", "O", // open, open interactively
  ".", // toggle hidden
);

// Keys that open a prompt or picker. Whatever follows is typed into it.
const prompts = keys(
  "a", "r", "/", "?", "n", "N", "f", ":", ";", "s", "S", "z", "Z",
);

// Editing keys inside a prompt, e.g. Ctrl+K kills to the end of line.
const promptEditing = keys(
  "\x0b", "\x15", "\x17", "\x08", "\x7f", // Ctrl+K, Ctrl+U, Ctrl+W, Ctrl+H, Backspace
  "\x1b[H", "\x1b[F", "\x01", "\x05", // Home, End, Ctrl+A, Ctrl+E
);

// Tabs, sorting, line modes, the task list, help and the preview pane.
const views = keys(
  "t", "1", "2", "3", "[", "]", "{", "}", "\x1b[Z",
  ",m", ",M", ",s", ",S", ",n", ",e", ",r", ",N", // sorting
  "mn", "ms", "mm", "mp", "mo", // line modes
  "~", "w", "\x0c", "\x1b[1;2A", "\x1b[1;2B", // help, tasks, redraw, seek preview
);

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [20, fileOps],
    [10, prompts],
    [10, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [6, promptEditing],
    [8, views],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q", "Q")],
  ]),
);
