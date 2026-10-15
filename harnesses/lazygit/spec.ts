// Bombadil specification for lazygit, the git TUI.
//
// Runs in the Nix sandbox, because lazygit runs custom shell commands and
// can discard work. Keys follow lazygit's default keybindings; Ctrl+Z
// (suspend) and Ctrl+C (quit) are left out on purpose.
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

// Go panics and runtime fatal errors print a trace. Errors lazygit doesn't
// expect, including panics gocui recovers, end in log.Fatalf with "An error
// occurred! Please create an issue at ...".
export const noPanic = noCrashText(
  /panic: |fatal error: |goroutine \d+ \[|An error occurred! Please create an issue/,
);

// Actions

const navigate = keys(
  "h", "j", "k", "l",
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "\x1b[1;2A", "\x1b[1;2B", // Shift+Up/Down: range select
  "\x1b[5~", "\x1b[6~", "<", ">", ",", ".", "[", "]", "v",
  "\r", "\x1b", "\t", "\x1b[Z", "0",
);

// Jump to the status, files, branches, commits and stash panels.
const panels = keys("1", "2", "3", "4", "5");

// Staging, committing, branching, history and remotes. They only touch the
// run's copy of the seed repository and its remote.
const gitOps = keys(
  " ", "a", "c", "C", "A", "d", "D", "s", "S", "g", "i",
  "n", "N", "M", "r", "R", "e", "o", "f", "F", "p", "P", "u",
  "z", "Z", "y", "t", "T", "b", "B", "V", "w", "-", "=", "*",
  "\x0a", "\x0b", // Ctrl+J, Ctrl+K: move a commit down or up
);

// Inside a file's diff: toggle hunk or line selection, stage or discard
// the selection, edit the hunk, move between hunks and files, and switch
// between the staged and unstaged panes.
const staging = keys("\r", "a", "v", " ", "d", "E", "h", "l", "n", "N", "\t", "\x07");

// Inside a conflicted file: pick a hunk or both, move between hunks and
// conflicts, undo, and the merge conflict and merge/rebase options.
const conflicts = keys(" ", "b", "j", "k", "h", "l", "z", "M", "m");

// Interactive rebase: start, edit, pick, squash, fixup, apply fixups, drop,
// mark a base commit, and the options to continue, skip or abort.
const rebase = keys("i", "e", "p", "s", "f", "F", "S", "d", "B", "m", "c");

// Custom patches, built from a commit's files and applied from the patch
// options menu.
const customPatch = keys("\r", " ", "a", "\x10"); // Enter, toggle, all, Ctrl+P

// Filtering, diffing, log options and diff display.
const views = keys(
  "?", "/", "x", "+", "_", "@", "W", "`", ":",
  "\x12", // Ctrl+R: recent repos
  "\x13", // Ctrl+S: filter the commit log
  "\x05", // Ctrl+E: diffing options
  "\x02", // Ctrl+B: filter files by status
  "\x0c", // Ctrl+L: log options
  "\x17", // Ctrl+W: toggle whitespace
  "(", ")", "{", "}", "|", "\\",
);

export const drive = pauseAfterEscape(
  weighted([
    [30, navigate],
    [10, panels],
    [20, gitOps],
    [8, staging],
    [5, conflicts],
    [6, rebase],
    [4, customPatch],
    [8, views],
    [10, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q")],
  ]),
);
