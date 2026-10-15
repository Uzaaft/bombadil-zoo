// Bombadil specification for ncdu.
//
// Runs in the Nix sandbox, because ncdu deletes files and spawns a shell.
// No quit key: ncdu quits on q without asking, and at about 100 actions a
// second, q ended most runs within a second.
import { always, eventually } from "@antithesishq/bombadil";
import { weighted } from "@antithesishq/bombadil/terminal";
import {
  exited,
  keys,
  noCrashText,
  pauseAfterEscape,
  resize,
  screen,
  startsShowing,
  typePrintableExcept,
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

// The seed tree is small, so a delete, even of the 2000-entry directory,
// finishes in well under a second. A "Deleting..." box that stays up means
// ncdu hangs. An error box replaces it when a delete fails.
export const deletesFinish = always(
  eventually(
    () => !!exited.current || !/Deleting\.\.\./.test(screen.current ?? ""),
  ).within(5, "seconds"),
);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "j", "k", "h", "l",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F", "\r", "<", "\x7f", "\x1b",
);

// Sorting, display toggles, shared sizes, info, refresh and hidden files.
// M and m only work with -e, so they test that they're ignored.
const views = keys(
  "n", "s", "C", "M", "a", "e", "t", "g", "c", "m", "u", "i", "r", "?",
  "\t", "<",
);

// The info box keeps its own keys and passes the rest to the browser, and
// the help box has three tabs and scrolls.
const boxes = keys(
  "i", "ij", "ik", "i\x1b[B", "i1", "i2", "id", "ir", "ie",
  "?", "?1", "?2", "?3", "?j", "?h", "?l", " ", "1", "2", "3",
);

// Deleting asks for confirmation: h picks yes, l picks no, and l twice
// picks "don't ask again". An unreadable directory makes deletion fail,
// and the error box has the same keys. Only the run's copy of the seed
// tree is affected.
const deletes = keys(
  "d", "dh\r", "dl\r", "d\r", "dll\r", "h", "l", "\r", "\x1b",
);

// The shell runs in the run's copy of the seed tree; exit returns to ncdu.
const shell = keys("b", "exit\r");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [20, views],
    [10, boxes],
    [10, deletes],
    [2, shell],
    [5, typePrintableExcept("q")],
    [3, resize([20, 200], [5, 60])],
  ]),
);
