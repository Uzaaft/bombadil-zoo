// Bombadil specification for btop.
//
// No random typing and no signal keys (k, t, i, s): in the sandbox, the
// processes btop shows include bombadil and its workers.
import { weighted } from "@antithesishq/bombadil/terminal";
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

// btop's CPU box is up.
export const startsUp = startsShowing(/cpu/i);

// Actions

const navigate = keys(
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D", "j", "k",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F", "\r", "\x1b", "\t",
);

// Boxes, presets, sorting, tree view and the menus.
const views = keys(
  "1", "2", "3", "4", "5", "d", "p", "P", "m", "o", "e", "r", "c", "f",
  "\x1b[1;2C", "\x1b[1;2D", "-", "+", "<", ">", "b", "n", "g", "/", "?",
  "F", "M", "h",
);

// Filtering, as whole sequences that open the field first: typed outside
// it, letters are shortcuts, and s opens the signals menu. The text avoids
// k, t, i and s for the same reason.
const filterText = keys("/bomb\r", "/yaz\r", "/zz\r", "/b\x7f\r", "/\x1b");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [35, views],
    [10, filterText],
    [5, resize([20, 200], [5, 60])],
    [1, keys("q")],
  ]),
);
