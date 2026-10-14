// Bombadil specification for yazi, the terminal file manager.
//
// Runs inside a Nix build sandbox (see default.nix), because yazi's shell
// prompts execute whatever gets typed into them.
import { always, eventually } from "@antithesishq/bombadil";
import { CharSet } from "@antithesishq/bombadil/actions";
import {
  type ActionTemplate,
  extract,
  weighted,
} from "@antithesishq/bombadil/terminal";
import {
  CharSets,
  typeFromSet,
} from "@antithesishq/bombadil/terminal/defaults/actions";
export {
  exitSuccess,
  noReplacementChars,
} from "@antithesishq/bombadil/terminal/defaults/properties";

const screen = extract((state) => {
  const rows = [];
  for (let i = 0; i < state.grid.size.rows; i++) {
    rows.push(state.grid.rowText(i));
  }
  return rows.join("\n");
});

const exited = extract((state) => state.exitStatus !== null);

// Properties

// A Rust panic prints "panicked at" before yazi exits.
export const noPanic = always(
  () => !/panicked at/.test(screen.current ?? ""),
);

// The screen may blank during a redraw, but never stays blank while yazi is
// running.
export const neverStuckBlank = always(
  eventually(
    () => !!exited.current || (screen.current ?? "").trim() !== "",
  ).within(5, "seconds"),
);

// Actions

const keys = (...literals: string[]) =>
  typeFromSet(CharSet.fromLiterals(...literals));

const navigate = keys(
  "h", "j", "k", "l",
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "gg", "G", "J", "K", "H", "L",
  "\r", "\x1b", "\t",
);

// Selection, clipboard and file operations. They only touch the run's
// scratch copy of the seed tree.
const fileOps = keys(
  " ", "v", "V", "\x01", // select, visual, visual unset, select all
  "y", "x", "p", "P", "Y", "X", // yank, cut, paste, paste overwrite, unyank
  "d", "D", "u", // trash, delete, undo
  "c", "cc", "cd", "cf", "cn", // copy path variants
  ".", // toggle hidden
);

// Keys that open a prompt. Whatever follows is typed into it.
const prompts = keys("a", "r", "/", "?", "f", ":", ";", "s", "S", "z", "Z");

const tabs = keys("t", "1", "2", "3", "[", "]", "{", "}", "\x1b[Z");

const views = keys("~", "w", ",", "m", "'", "\x0c", "\x1b[5~", "\x1b[6~");

const resize: ActionTemplate = {
  Resize: { columns: [20, 200], rows: [5, 60] },
};

export const drive = weighted([
  [40, navigate],
  [20, fileOps],
  [10, prompts],
  [10, typeFromSet(CharSets.ASCII_PRINTABLE)],
  [8, tabs],
  [6, views],
  [3, typeFromSet(CharSets.UNICODE_SAFE)],
  [2, resize],
  [1, keys("q", "Q")],
]);
