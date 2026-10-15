// Bombadil specification for superfile, the terminal file manager.
//
// Runs in the Nix sandbox, because superfile copies, deletes and opens
// files and can run shell commands.
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
export { neverStuckBlank } from "../../lib/spec/common.ts";

// Properties

// Go panics and runtime fatal errors print a trace before superfile exits.
export const noPanic = noCrashText(/panic: |fatal error: |goroutine \d+ \[/);

// The file panel lists the seed tree.
export const startsUp = startsShowing(/one-megabyte\.bin/);

// Actions

const navigate = keys(
  "j", "k", "h", "l",
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "\x1b[5~", "\x1b[6~", "\x1b[H", "\x1b[F",
  "\r", "\x1b", "\t", "\x1b[Z",
);

// Panels: new, close, focus the sidebar, processes and metadata, toggles.
const panels = keys("n", "w", "s", "p", "m", "f", "F", "\x0e", "\x17", "[", "]");

// Selection and file operations. They only touch the run's copy of the
// seed tree.
const fileOps = keys(
  "v", "A", "\x01", // select mode, select all
  "\x03", "\x18", "\x16", "\x04", // Ctrl+C copy, Ctrl+X cut, Ctrl+V paste, Ctrl+D delete
  "\x12", "\x05", "\x10", // Ctrl+R rename, Ctrl+E extract, Ctrl+P copy path
  "\x0e", "\x06", "\x0f", // Ctrl+N new file, Ctrl+F new folder, Ctrl+O compress
  "e", "E", "o", ".", // open in editor, open dir in editor, open, toggle hidden
);

// Prompts: search, the command prompt and the sort and help menus.
const prompts = keys("/", ":", "?", "o", ">", "~");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [10, panels],
    [20, fileOps],
    [10, prompts],
    [12, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q", "Q")],
  ]),
);
