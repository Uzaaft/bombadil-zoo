// Bombadil specification for Neovim.
//
// Neovim exits with a nonzero code on purpose (`:cq`), so this spec checks
// for fatal signals and Neovim's own internal-error messages instead of
// exitSuccess.
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
export { noReplacementChars } from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// Properties

// Messages Neovim prints when its own invariants break, and what a crash
// prints before the process dies.
export const noInternalError = noCrashText(
  /E315: ml_get|E316: ml_get|E685: Internal error|Internal error:|Assertion .* failed|Vim: Caught deadly signal|nvim: .*ASSERT|E1500:/,
);

// The first file, src/main.c, is on screen.
export const startsUp = startsShowing(/#include <stdio\.h>/);

// Actions

const motions = keys(
  "h", "j", "k", "l", "w", "b", "e", "W", "B", "0", "$", "^",
  "gg", "G", "50%", "{", "}", "(", ")", "%", "f(", "t;", ";", ",",
  "\x04", "\x15", "\x06", "\x02", "\x05", "\x19", // Ctrl+D/U/F/B/E/Y scrolling
  "H", "M", "L", "zz", "zt", "zb", "*", "#", "n", "N",
);

// Changes in normal mode, with text objects and counts.
const edits = keys(
  "x", "X", "dd", "dw", "D", "cc", "ciw", "ci(", "das", "yy", "yiw", "p",
  "P", "u", "\x12", ".", "J", "gJ", ">>", "<<", "==", "~", "g~iw", "gUU",
  "3dd", "5x", "r!", "R", "\x01", "\x18", // Ctrl+A, Ctrl+X increment/decrement
  "ddp", "xp", "qaq", "qadwjq", "@a", "@@", "ma", "'a", "`a",
);

// Entering insert mode, with completion and register paste inside it.
const insert = keys(
  "i", "a", "o", "O", "I", "A", "s", "S", "C",
  "\x0e", "\x10", "\x12\"", "\x17", "\x15", // Ctrl+N/P completion, Ctrl+R ", Ctrl+W, Ctrl+U
);

// Visual modes and block operations.
const visual = keys("v", "V", "\x16", "gv", "o", "I", "A", "c", "d", "y", ">", "<", "u", "U");

// Windows, tabs, buffers and folds.
const windows = keys(
  "\x17s", "\x17v", "\x17w", "\x17q", "\x17o", "\x17=", "\x17_", "\x17|",
  "gt", "gT", "zf3j", "za", "zR", "zM", "zo", "zc", "zE",
);

// Ex commands, including ones that touch other files and the shell.
const ex = keys(
  ...[
    "%s/i/I/g", "g/text/d", "v/x/normal dd", "sort", "sort! n", "split",
    "vsplit", "tabnew", "tabclose", "bnext", "bprev", "bdelete", "edit data.json",
    "edit long-lines.txt", "edit blob.bin", "edit crlf.txt", "set wrap!",
    "set list!", "set number!", "set relativenumber!", "set ft=json",
    "syntax off", "syntax on", "help", "help motion", "undo 0", "earlier 10",
    "later 10", "normal! ggdG", "1,5d", "$put =range(1,50)", "%!sort",
    "r !echo hi", "terminal", "messages", "registers", "marks", "jumps",
    "changes", "ls", "w", "w! new.txt", "e!", "noh", "redraw!", "checkhealth",
  ].map((c) => `:${c}\r`),
  ":", "/", "?", "q:",
);

// Ex commands that exercise Neovim's heavier machinery: quickfix and
// vimgrep, substitutions with expressions and backreferences, folding
// methods, spell checking, undo tree jumps, retab, commands over every
// window or buffer, and autocommands that fire on later edits.
const exDeep = keys(
  ...[
    "vimgrep /line/j **/*", "vimgrep /x/ big.txt", "copen", "cclose", "cnext",
    "cprev", "cfirst", "clast", "lvimgrep /f/ %", "lopen", "colder", "cnewer",
    "%s/\\(\\w\\+\\) \\(\\w\\+\\)/\\2 \\1/g",
    "%s/\\d\\+/\\=submatch(0)*2/g", "%s/^/\\=line('.').': '/",
    "%s/\\v(a|e|i)+/[&]/gi", "%s/x\\{3,}/X/g", "s/\\%V./#/g",
    "set foldmethod=indent", "set foldmethod=syntax", "set foldmethod=marker",
    "set foldmethod=manual", "set foldcolumn=4", "%foldclose", "%foldopen",
    "set spell", "set nospell", "set list listchars=tab:>-,trail:~",
    "undo 3", "undo 0", "earlier 1f", "later 1f", "undolist",
    "set expandtab", "retab", "retab! 8", "set noexpandtab", "%retab!",
    "windo set number", "bufdo normal! gg", "tabdo echo 1", "argdo normal! G",
    "autocmd TextChanged * normal! zz", "autocmd InsertLeave * silent! %s/  / /g",
    "autocmd! TextChanged", "autocmd! InsertLeave",
    "let @a = 'dwjj'", "normal! 5@a", "5normal! x", "%normal! A;",
    "g/^/m0", "sort u", "sort /\\d\\+/ n", "%!rev", "put =repeat('x', 300)",
    "set virtualedit=all", "set virtualedit=", "set textwidth=20", "normal! gqap",
    "set conceallevel=2", "set ft=c", "set ft=python", "set ft=markdown",
    "tabnew big.txt", "new", "vnew", "only", "ball", "sball", "enew",
  ].map((c) => `:${c}\r`),
);

// Visual block insert and append, and blockwise operations over ragged
// lines.
const block = keys(
  "\x163jIx\x1b", "\x163j$Aend\x1b", "\x165jc##\x1b", "\x162jr*",
  "\x163jd", "\x16G$y", "\x163jo", "\x163jO", "gv", "\x163j>",
);

// Completion menus in insert mode: keyword, line, file and omni.
const completion = keys(
  "a\x0e", "a\x0e\x0e\x10", "o\x18\x0c", "a\x18\x06", "a\x18\x0f",
  "a\x18\x0e", "a\x18\x0b", "a\x18s", "\x19", "\x05",
);

// :terminal: open one, type into its shell, leave terminal mode with
// Ctrl+\ Ctrl+N, and close it.
const terminal = keys(
  ":terminal\r", ":terminal echo hi\r", "i", "echo ünïcödé\r", "ls -la\r",
  "exit\r", "\x1c\x0e", "\x17\x17", ":bd!\r",
);

// The command-line window, opened from the command line, and history.
const cmdwin = keys("q:", "q/", "q?", ":\x06", "/\x06", "\r", ":q\r");

export const drive = pauseAfterEscape(
  weighted([
    [25, motions],
    [15, edits],
    [8, insert],
    [6, visual],
    [5, windows],
    [8, ex],
    [8, exDeep],
    [4, block],
    [4, completion],
    [3, terminal],
    [2, cmdwin],
    [12, typeFromSet(CharSets.ASCII_PRINTABLE)],
    [3, typeFromSet(CharSets.UNICODE_SAFE)],
    [10, keys("\x1b")],
    [2, resize([20, 200], [5, 60])],
    [1, keys(":q!\r", ":qa!\r", "ZZ", "ZQ")],
  ]),
);
