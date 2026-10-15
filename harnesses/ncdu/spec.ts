// Bombadil specification for ncdu.
//
// Runs in the Nix sandbox, because ncdu deletes files and spawns a shell.
// No random typing and no quit key: ncdu has no text fields, and at about
// 100 actions a second, q ended most runs within a second.
import { weighted } from "@antithesishq/bombadil/terminal";
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

// Zig panics print "panic:" before aborting.
export const noPanic = noCrashText(/panic: |reached unreachable code/);

// ncdu's header is up, while scanning or browsing.
export const startsUp = startsShowing(/ncdu/);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "j", "k", "h", "l",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F", "\r", "<", "\x1b",
);

// Sorting, display toggles, info, refresh and hidden files.
const views = keys(
  "n", "s", "C", "M", "a", "d", "e", "t", "g", "c", "m", "i", "r", "?",
  "\t", "<",
);

// Deleting asks for confirmation; answer it either way. Only the run's
// copy of the seed tree is affected.
const deletes = keys("d", "dy", "dn", "d\r", "\x1b");

export const drive = pauseAfterEscape(
  weighted([
    [40, navigate],
    [25, views],
    [8, deletes],
    [3, resize([20, 200], [5, 60])],
  ]),
);
