// Bombadil specification for htop.
//
// htop runs in a PID namespace of its own, so nothing it does reaches
// bombadil. As PID 1 it handles SIGTERM, the kill menu's default, and
// quits, and the menu also offers signals like SIGSEGV, which htop would
// report as a crash of its own. So the kill keys (k, F9) are left out,
// and random typing leaves out k and q. Nothing sends F10, which also
// quits. The setup screens remove items with Delete instead of F9, since
// Delete does nothing on the main screen.
//
// htop draws unprintable characters and invalid UTF-8 in process data as
// U+FFFD on purpose (RichString.c). The processes the harness starts have
// only printable, valid UTF-8 names, so noReplacementChars stays a check
// on htop's own rendering, e.g. cutting a character in half. In htop
// 3.5.3 it fails for two real bugs: the command screen (w) wraps every
// COLS bytes and splits multibyte characters, its own "│" separator
// included, and the environment screen (e) shows bytes past the end of
// /proc/<pid>/environ, because Platform_getProcessEnv counts its last
// read twice.
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

// htop's header and process table are up.
export const startsUp = startsShowing(/PID|Load average/);

// Keys

const up = "\x1b[A";
const down = "\x1b[B";
const right = "\x1b[C";
const left = "\x1b[D";
const enter = "\r";
const esc = "\x1b";
const del = "\x1b[3~";
const backspace = "\x7f";
const f = {
  1: "\x1bOP", 2: "\x1bOQ", 3: "\x1bOR", 4: "\x1bOS", 5: "\x1b[15~",
  6: "\x1b[17~", 7: "\x1b[18~", 8: "\x1b[19~",
};
const shiftF3 = "\x1b[1;2R";

// Actions

const navigate = keys(
  up, down, right, left, "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F",
  enter, esc, "\t", "\x1b[Z", backspace, "\x0c", // Shift+Tab, collapse, Ctrl+L
);

// Tags: Space tags, c tags the children, U untags all.
const tags = keys(" ", " ", "c", "U", `${down} ${down} `);

// Sorting, the tree view, threads, follow, the views of one process and
// the screen tabs: help (F1, h, ?), sort column (F6, <, >, ., ,), tree
// (t, F5, +, -, *, =), paths, merged command, container, meters (#),
// pause (Z), and the user, affinity and scheduling pickers (u, a, Y).
const views = keys(
  "M", "P", "T", "N", "I", "t", "+", "-", "=", "*", "H", "K", "p", "m",
  "O", "F", "Z", "z", "#", "<", ">", ".", ",", "u", "a", "Y", "?", "h",
  "b", f[1], f[5], f[6],
);

// The strace, lsof, environment, command line and locks views, which run
// strace and lsof or read /proc, and the keys their screens take: search,
// filter, refresh or auto-scroll (F5, F8), and Esc to leave.
const processViews = keys(
  "s", "l", "e", "w", "x", "i",
  f[3], f[4], f[5], f[8], "/dev\r", "\\lib\r", esc,
);

// The setup screen (F2, S, C), then a category: display options, header
// layout, meters, screens, colors, columns. Right enters its panels.
const openSetup = keys(
  ...[0, 1, 2, 3, 4, 5].map((n) => f[2] + down.repeat(n) + right),
  ...[0, 1, 2, 3, 4, 5].map((n) => f[2] + down.repeat(n) + right + right),
  "S", "C",
);

// Keys the setup panels take: toggle and add (Space, Enter), meter style
// (F4, t), add meters left or right (F5, F6, l, r), move (F7, F8, [, ], -,
// +), remove (Delete), new and rename screens (F5, Ctrl+N, F2, Ctrl+R),
// numbers typed into display options, Backspace, and select by typing.
const setup = keys(
  up, down, left, right, enter, " ", esc, "\x1b[5~", "\x1b[6~", "\x1b[H",
  "\x1b[F", f[4], f[5], f[6], f[7], f[8], del, "t", "l", "r", "[", "]",
  "-", "+", "\x0e", "\x12", "0", "9", "99999", backspace, "a", "m",
);

// Renaming or creating a screen with a name that is empty, long, full of
// spaces or symbols, or not ASCII, which htop drops.
const screenNames = keys(
  "\x12" + "x".repeat(80) + enter,
  "\x12\x15" + enter,
  "\x12" + "   " + enter,
  "\x12\x15!@#$%^&*()[]{}" + enter,
  "\x12\x15日本語 é" + enter,
  "\x0e" + "New" + enter,
  "\x0e" + enter,
  f[2] + esc,
);

// Search (F3, /) and filter (F4, \), as whole sequences that open the
// field first, so letters aren't read as shortcuts: names of the
// harness's processes, regex and filter syntax, text longer than the
// field, non-ASCII, which htop drops, and the line editor's keys.
const search = keys(
  "/sleep\r", "/zz\r", "\\sleep\r", "\\\x1b", f[3], f[4], shiftF3,
  "/1d" + f[3] + f[3] + shiftF3 + esc,
  "/sl" + down + down + up + enter,
  "\\" + "option-".repeat(30) + enter,
  "\\.*[(|\\" + enter,
  "\\sleep|htop" + enter,
  "\\ " + enter,
  "\\" + "é日本" + enter,
  "/" + "x".repeat(300) + esc,
  "\\abc def\x01\x05\x02\x06\x17\x0b\x15" + enter, // Ctrl+A E B F W K U
  "\\sleep" + left + left + del + backspace + "\x1b[H" + "\x1b[F" + enter,
  "\\café" + "\x1b[1;5D" + "\x1b[1;5C" + enter, // Ctrl+Left, Ctrl+Right
);

// Renicing the selected or tagged processes: nice up and down (F7, F8).
const renice = keys(f[7], f[8], "]", "[");

export const drive = pauseAfterEscape(
  weighted([
    [25, navigate],
    [10, tags],
    [25, views],
    [8, processViews],
    [6, openSetup],
    [20, setup],
    [3, screenNames],
    [10, search],
    [6, renice],
    [6, typePrintableExcept("kq")],
    [5, resize([20, 200], [5, 60])],
    [1, resize([1, 20], [1, 8])],
  ]),
);
