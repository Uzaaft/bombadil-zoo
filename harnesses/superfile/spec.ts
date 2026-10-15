// Bombadil specification for superfile, the terminal file manager.
//
// Runs in the Nix sandbox, because superfile copies, deletes and opens
// files and can run shell commands. Keys follow superfile 1.6.0's default
// hotkeys (src/superfile_config/hotkeys.toml), in which q and Esc quit.
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

// superfile is up. Its file panel fills in asynchronously, so the first
// frame only has the sidebar.
export const startsUp = startsShowing(/superfile/);

// Actions

// Moving in a list, into a directory (Enter, l, Right) and out of it (h,
// Left, Backspace, -), and between panels (Tab, L, H, Shift+Left).
const navigate = keys(
  "j", "k", "h", "l", "-",
  "\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D",
  "\x1b[5~", "\x1b[6~", "\x7f",
  "\r", "\t", "L", "H", "\x1b[1;2D",
);

// Panels and focus: new (n), split (N), close (w), the sidebar (s), the
// process bar (p), metadata (m), the preview (f), the footer (F), pinning
// the current directory (P), sorting (o, R) and select mode (v), with its
// own J, K and A.
const panels = keys(
  "n", "N", "w", "s", "p", "m", "f", "F", "P", "o", "R", "v", "J", "K", "A",
);

// File operations. They only touch the run's copy of the seed tree.
const fileOps = keys(
  "\x03", "\x18", "\x16", "\x17", // Ctrl+C copy, Ctrl+X cut, Ctrl+V and Ctrl+W paste
  "\x04", "\x1b[3~", "D", // Ctrl+D and Delete to trash, D to delete for good
  "\x0e", "\x12", // Ctrl+N create, Ctrl+R rename: both open a prompt
  "\x01", "\x05", // Ctrl+A compress, Ctrl+E extract
  "\x10", "c", // Ctrl+P copy the path, c copy the working directory
  "e", "E", ".", // edit file, edit directory (EDITOR is true), dot files
);

// Prompts and menus: search, the shell command line (:), superfile's own
// prompt (>), help, and zoxide, which is off and only reports that.
const prompts = keys("/", ":", ">", "?", "z");

// Whole flows that only work as a sequence, typed at once: creating files
// and directories, renaming, searching, superfile's prompt commands,
// compressing everything and extracting it again, and picking a sort.
const flows = keys(
  "\x0enew-file.txt\r", "\x0enew-dir/\r", "\x0eünïcödé 日本.txt\r", "\x0e\r",
  "\x12renamed.txt\r", "\x12\x15\r", // rename, and rename to nothing
  "/docs\r", "/ünïcödé\r", "/zzz\r",
  ">split\r", ">cd docs\r", ">cd ..\r", ">cd /nonexistent\r", ">open data.json\r",
  ">bogus\r", ":echo hi\r",
  "vA\x01", "vA\x03", "vJJ\x18", // select mode and act on a selection
  "\x01\r", "\x05\r", // compress or extract, then confirm
  "ojj\r", "okk\r", // the sort menu
  "?jj", "?\x1b[6~k", // the help menu
);

// Leaving prompts and menus. Outside them, Esc and q quit superfile, which
// ends the run, so these are rare.
const leave = keys("\x1b", "\x03");

export const drive = pauseAfterEscape(
  weighted([
    [35, navigate],
    [12, panels],
    [15, fileOps],
    [6, prompts],
    [10, flows],
    [10, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [3, leave],
    [2, resize([20, 200], [5, 60])],
    [1, keys("q", "Q")],
  ]),
);
