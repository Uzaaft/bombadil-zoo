// Bombadil specification for tig.
//
// Runs in the Nix sandbox, because tig runs git and shell commands.
// No quit keys: at about 100 actions a second, even a rarely chosen q
// would end most runs within a second or two.
import { weighted } from "@antithesishq/bombadil/terminal";
import {
  CharSets,
  typeFromSet,
} from "@antithesishq/bombadil/terminal/defaults/actions";
import {
  keys,
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

// The main view lists the seed repository's history.
export const startsUp = startsShowing(/\[main\]/);

// Actions

const navigate = keys(
  "j", "k", "\x1b[A", "\x1b[B", "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F",
  " ", "-", "\r", "\t", "\x1b", ",", "<", "J", "K",
);

// The views: main, diff, log, reflog, tree, blob, blame, refs, status,
// stage, stash, grep, pager and help.
const views = keys("m", "d", "l", "L", "t", "f", "B", "r", "s", "c", "y", "G", "p", "h", "?");

// Searching, toggles and options.
const options = keys(
  "/", "?", "n", "N", "o", "I", "#", "~", "%", "$", "D", "A", "F", "W",
  "\x0e", "\x10", "\x0c",
);

// Actions on the selected line: stage, unstage, revert, cherry-pick,
// checkout, edit and the prompt.
const gitOps = keys("u", "U", "!", "C", "e", "@", ":", "R", "\x0c");

// Text goes in through the search and command prompts. Typed anywhere
// else, letters are shortcuts, and q quits.
const prompts = keys(
  "/commit\r", "/ünïcödé\r", "/[\r", "?main\r", ":view-log\r",
  ":view-blame\r", ":toggle line-number\r", ":set wrap-lines = yes\r",
  ":!git log --oneline -3\r", ":goto HEAD~3\r", ":bogus\r", ":\x1b",
);

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [20, views],
    [12, options],
    [10, gitOps],
    [10, prompts],
    [2, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [2, typeFromSet(CharSets.UNICODE_SAFE)],
    [3, resize([20, 200], [5, 60])],
  ]),
);
