// Bombadil specification for btop.
//
// btop runs in a PID namespace of its own, so its signals only reach
// itself. As PID 1 it ignores SIGKILL, but it handles SIGTERM and SIGINT
// and quits, so terminate (t), interrupt (i) and the signals menu (s),
// which defaults to SIGTERM, are left out, as is q. Random typing leaves
// out the same letters.
import { weighted } from "@antithesishq/bombadil/terminal";
import {
  keys,
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

// Filtering, as whole sequences that open the field first.
const filterText = keys("/bomb\r", "/yaz\r", "/zz\r", "/b\x7f\r", "/\x1b");

// Killing the selected process, confirming or cancelling. Only btop
// itself can be selected, and it ignores SIGKILL as PID 1.
const signals = keys("k", "k\r", "k\x1b");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [35, views],
    [10, filterText],
    [8, signals],
    [6, typePrintableExcept("qtis")],
    [5, resize([20, 200], [5, 60])],
  ]),
);
