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
} from "../../lib/spec/common.ts";
export {
  exitSuccess,
  noReplacementChars,
} from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// Properties

// A Rust panic prints "panicked at" before gitui exits.
export const noPanic = noCrashText(/panicked at/);

// gitui's tab bar is up. Repository data fills in asynchronously.
export const startsUp = startsShowing(/Status \[1\]|Log \[2\]/);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "h", "j", "k", "l",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F", "\x1b[1;2A", "\x1b[1;2B",
  "\r", "\x1b", "\t", "\x1b[Z",
);

// The status, log, files, stashing and stashes tabs.
const tabs = keys("1", "2", "3", "4", "5");

// Staging, committing, branching and history. They only touch the run's
// copy of the seed repository and its remote.
const gitOps = keys(
  " ", "a", "s", "D", "c", "A", "e", "i", "u", "b", "t", "T", "m", "M",
  "f", "p", "P", "F", "r", "R", "d", "x", "y", "z", "Z", "o", "O", "w",
  "S", "\x08", "\x7f",
);

// Popups: help, options, find, commands and the branch list.
const popups = keys("h", "?", "/", "\x05", "\x06", "o", "B", "l", "\x14");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [10, tabs],
    [25, gitOps],
    [8, popups],
    [12, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q")],
  ]),
);
