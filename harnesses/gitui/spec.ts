// Bombadil specification for gitui.
//
// Runs in the Nix sandbox, because gitui stages, commits, discards and
// pushes.
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
  typePrintableExcept,
} from "../../lib/spec/common.ts";
export {
  exitSuccess,
  noReplacementChars,
} from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// No quit key, and random typing leaves out q: at about 100 actions a
// second, even a rarely chosen q ended about a third of the runs early.
// Ctrl+C, the hard exit, is left out too. Keys follow gitui's defaults.

// Properties

// The panic hook prints "GitUI was closed due to an unexpected panic" and
// the panic message, which starts with "panicked at".
export const noPanic = noCrashText(/panicked at|unexpected panic/);

// gitui's tab bar is up. Repository data fills in asynchronously.
export const startsUp = startsShowing(/Status \[1\]|Log \[2\]/);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "h", "j", "k", "l",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F", "\x1b[1;2A", "\x1b[1;2B",
  "\x1b[1;2C", "\x1b[1;2D", // Shift+Right/Left: expand or collapse a tree
  "\r", "\x1b", "\t", "\x1b[Z",
);

// The status, log, files, stashing and stashes tabs.
const tabs = keys("1", "2", "3", "4", "5");

// Staging, committing, branching and history. They only touch the run's
// copy of the seed repository and its remote.
const gitOps = keys(
  " ", "a", "s", "D", "c", "A", "e", "i", "u", "b", "t", "T", "m", "M",
  "f", "p", "P", "F", "r", "R", "d", "x", "y", "z", "Z", "o", "O", "w",
  "S", "U", "n", "\x08", "\x7f",
);

// Popups and views: help, options, find, the command bar, the branch and
// tag lists, blame, file history, comparing commits and going to a line.
const popups = keys(
  "h", "?", "/", ".", "o", "B", "H", "C", "L", "l", "T",
  "\x05", // Ctrl+E: the commit message in the editor
  "\x06", // Ctrl+F: toggle commit hooks
  "\x12", // Ctrl+R: remotes
  "\x0a", // Ctrl+J: find a commit by SHA
);

// Inside the commit popup: amend, sign off, the message history, and
// commit.
const commit = keys(
  "c",
  "\x01", // Ctrl+A: amend, or annotate a tag
  "\x13", // Ctrl+S: sign off
  "\x0e", // Ctrl+N: next message from the history
  "\x04", // Ctrl+D: commit
);

// Input the branch, tag, remote, find and go-to-line prompts have to
// reject or handle: invalid ref names, names that exist, URLs, line numbers
// out of range or malformed, and long or non-ASCII text.
const names = keys(
  "..", "@{", "~^:", "a/", "/a", "-x", "a.lock", "HEAD", "main",
  "feature", "v1", "origin", "../remote.git", "file:///nonexistent",
  "-1", "-999", "0", "9999999999999999999999", "1-2", "--",
  "x".repeat(300), "ünï 日本",
);

export const drive = pauseAfterEscape(
  weighted([
    [32, navigate],
    [10, tabs],
    [22, gitOps],
    [10, popups],
    [4, commit],
    [4, names],
    [10, typePrintableExcept("q")],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
  ]),
);
