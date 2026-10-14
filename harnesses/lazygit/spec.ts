// Bombadil specification for lazygit, the git TUI.
//
// Runs in the Nix sandbox, because lazygit runs custom shell commands and
// can discard work.
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

// Go panics and runtime fatal errors print a trace before lazygit exits.
export const noPanic = noCrashText(/panic: |fatal error: |goroutine \d+ \[/);

// Actions

const navigate = keys(
  "h", "j", "k", "l",
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "\x1b[5~", "\x1b[6~", "<", ">", ",", ".",
  "\r", "\x1b", "\t", "\x1b[Z",
);

// Jump to the status, files, branches, commits and stash panels.
const panels = keys("1", "2", "3", "4", "5");

// Staging, committing, branching and history. They only touch the run's
// copy of the seed repository.
const gitOps = keys(
  " ", "a", "c", "C", "A", "d", "D", "s", "S", "g",
  "n", "M", "r", "R", "e", "o", "i", "f", "p", "P",
  "z", "Z", "y", "t", "T", "F", "u",
);

// Menus, filters and views.
const views = keys("?", "/", "x", "+", "_", "@", "w", "W", "m", "`", ":");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [10, panels],
    [25, gitOps],
    [10, views],
    [12, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q")],
  ]),
);
