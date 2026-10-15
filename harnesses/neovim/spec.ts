// Bombadil specification for Neovim.
//
// Neovim exits with a nonzero code on purpose (`:cq`), so this spec checks
// for fatal signals and Neovim's own internal-error messages instead of
// exitSuccess.
import { ActionGenerator } from "@antithesishq/bombadil/actions";
import { type ActionTemplate, weighted } from "@antithesishq/bombadil/terminal";
import {
  CharSets,
  typeFromSet,
} from "@antithesishq/bombadil/terminal/defaults/actions";
import {
  keys,
  noCrashText,
  pauseAfterEscape,
  resize,
  screen,
  startsShowing,
  typePrintableExcept,
} from "../../lib/spec/common.ts";
export { noReplacementChars } from "@antithesishq/bombadil/terminal/defaults/properties";
export { neverStuckBlank, noFatalSignal } from "../../lib/spec/common.ts";

// Properties

// Messages Neovim prints when its own invariants break, and what a crash
// prints before the process dies.
export const noInternalError = noCrashText(
  /E315: ml_get|E316: ml_get|E685: Internal error|Internal error:|Assertion .* failed|Vim: Caught deadly signal|nvim: .*ASSERT|E1500:/,
);

// An error from a Lua callback that Neovim's own runtime registered: an
// autocommand, a vim.schedule callback or a decoration provider, e.g.
// treesitter highlighting or diagnostics. The spec registers no callbacks
// of its own, and errors from :lua and from mappings show as E5108
// instead. Anchored to the start of a row, because :help api has an
// indented "Example using Lua callback:".
export const noRuntimeLuaError = noCrashText(
  /^(Lua callback|vim\.schedule callback): |^(Error in decoration provider|Decoration provider ".*" \(ns=)/m,
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
  // Ctrl+W c, not Ctrl+W q, which quits from the last window.
  "\x17s", "\x17v", "\x17w", "\x17c", "\x17o", "\x17=", "\x17_", "\x17|",
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
// Ctrl+\ Ctrl+N, and close it. The shell prints Unicode from ASCII input,
// see inTerminal below.
const terminal = keys(
  ":terminal\r", ":terminal echo hi\r", "i",
  "printf '\\303\\274n\\303\\257c\\303\\266d\\303\\251 \\346\\227\\245\\n'\r", "ls -la\r",
  "exit\r", "\x1c\x0e", "\x17\x17", ":bd!\r",
);

// The command-line window, opened from the command line, and history.
// Ctrl+C and :close leave it; :q would quit from the last window.
const cmdwin = keys("q:", "q/", "q?", ":\x06", "/\x06", "\r", "\x03", ":close\r");

// Lua through :lua: floating windows, including turning the current
// window into one and back; extmarks with virtual text, virtual lines,
// signs and conceal on the cursor line; diagnostics, also past the end of
// short buffers; treesitter; and vim.ui prompts.
const lua = keys(
  ...[
    "vim.api.nvim_open_win(0, true, {relative='editor', row=2, col=5, width=30, height=8, border='rounded', title='float'})",
    "vim.api.nvim_open_win(vim.api.nvim_create_buf(false, true), false, {relative='cursor', row=1, col=0, width=200, height=50, anchor='SE'})",
    "vim.api.nvim_open_win(0, true, {relative='win', row=999, col=999, width=1, height=1, zindex=300})",
    "vim.api.nvim_win_set_config(0, {relative='editor', row=0, col=0, width=12, height=3})",
    "vim.api.nvim_win_set_config(0, {split='left'})",
    "vim.api.nvim_win_set_config(0, {width=1, height=1})",
    "vim.api.nvim_buf_set_extmark(0, vim.api.nvim_create_namespace('z'), vim.fn.line('.')-1, 0, {virt_text={{'ВИРТ日本', 'Error'}}, virt_text_pos='inline'})",
    "vim.api.nvim_buf_set_extmark(0, vim.api.nvim_create_namespace('z'), vim.fn.line('.')-1, 0, {virt_text={{('x'):rep(300), 'Search'}}, virt_text_pos='right_align'})",
    "vim.api.nvim_buf_set_extmark(0, vim.api.nvim_create_namespace('z'), vim.fn.line('.')-1, 0, {virt_text={{'over', 'Todo'}}, virt_text_pos='overlay', hl_mode='blend'})",
    "vim.api.nvim_buf_set_extmark(0, vim.api.nvim_create_namespace('z'), vim.fn.line('.')-1, 0, {virt_lines={{{'above', 'Comment'}}, {{'twice', 'Comment'}}}, virt_lines_above=true})",
    "vim.api.nvim_buf_set_extmark(0, vim.api.nvim_create_namespace('z'), vim.fn.line('.')-1, 0, {sign_text='>>', line_hl_group='DiffAdd', number_hl_group='Error'})",
    "vim.api.nvim_buf_set_extmark(0, vim.api.nvim_create_namespace('z'), vim.fn.line('.')-1, 0, {end_col=#vim.api.nvim_get_current_line(), conceal='ü'})",
    "vim.api.nvim_buf_clear_namespace(0, -1, 0, -1)",
    "vim.diagnostic.set(vim.api.nvim_create_namespace('d'), 0, {{lnum=0, col=0, end_col=3, message='bad', severity=1}, {lnum=5, col=40, message='two\\nlines', severity=2}, {lnum=999, col=0, message='past the end', severity=3}})",
    "vim.diagnostic.config({virtual_lines=true})",
    "vim.diagnostic.config({virtual_lines=false, virtual_text=true, signs=true, underline=true})",
    "vim.diagnostic.open_float()", "vim.diagnostic.setqflist()",
    "vim.diagnostic.reset()",
    "vim.treesitter.start()", "vim.treesitter.stop()",
    "vim.ui.select({'a', 'b', 'c'}, {prompt='pick'}, print)",
    "vim.ui.input({prompt='in: '}, print)",
    "vim.api.nvim_buf_set_lines(0, 0, 0, false, {('日本'):rep(3000), ('\\t'):rep(100), ''})",
    "vim.api.nvim_buf_set_text(0, 0, 0, 0, 0, {'a', 'b', 'c'})",
    "vim.cmd.vsplit()", "vim.cmd('wincmd =')", "=vim.fn.getwininfo()",
    "vim.notify('note', vim.log.levels.WARN)", "vim.hl.range(0, vim.api.nvim_create_namespace('h'), 'Visual', {0, 0}, {5, 3})",
  ].map((c) => `:lua ${c}\r`),
  ":InspectTree\r", ":Inspect\r", ":EditQuery\r",
  ":set foldmethod=expr foldexpr=v:lua.vim.treesitter.foldexpr()\r",
  "]d", "[d", "\x17d", "van", "vin", "]n", "[n",
);

// Marks and the jump and change lists, including file marks across
// buffers and marks on lines that later edits delete.
const marks = keys(
  "\x0f", "\t", "5\x0f", "g;", "g,", "''", "``", "`[", "`]", "`<", "`>",
  "`.", "`^", "'\"", "mA", "'A", "`B", "mb", "'b", "]'", "['", "]`", "[`",
  ...[
    "delmarks!", "delmarks a-z", "delmarks A-Z0-9", "clearjumps",
    "keepjumps normal! G", "lockmarks %!sort", "'a,'bd", "'<,'>s/e/E/g",
    "k c", "'c,$normal! x",
  ].map((c) => `:${c}\r`),
);

// Diff mode between windows and against other files.
const diff = keys(
  "]c", "[c", "do", "dp",
  ...[
    "diffthis", "windo diffthis", "diffoff!", "diffupdate",
    "vert diffsplit src/app.py", "diffsplit README.md", "diffget", "diffput",
    "set diffopt+=iwhite,algorithm:patience,linematch:60",
    "set diffopt=internal,filler,closeoff,inline:char",
    "set diffopt=internal,filler,inline:word,context:0",
  ].map((c) => `:${c}\r`),
);

// Window layout under pressure: resizing splits to nothing and to
// everything, moving and rotating them, and options that take rows or
// columns from every window.
const layout = keys(
  "\x17<", "\x17>", "\x17+", "\x17-", "30\x17<", "40\x17+", "\x17H",
  "\x17J", "\x17K", "\x17L", "\x17T", "\x17r", "\x17x", "8\x17s",
  "\x17v\x17v\x17v\x17v\x17v",
  ...[
    "resize 1", "vertical resize 1", "resize 999", "vertical resize 999",
    "set winminwidth=0 winminheight=0", "set winwidth=1 winheight=1",
    "set cmdheight=0", "set cmdheight=4", "set cmdheight=1",
    "set laststatus=3", "set laststatus=0", "set showtabline=2",
    "set winbar=%f%=%l", "set winbar=", "set statuscolumn=%l\\ %s",
    "set statuscolumn=", "set signcolumn=yes:9", "set numberwidth=20 number",
    "set scrolloff=999", "set sidescrolloff=999 nowrap", "set smoothscroll",
    "set breakindent showbreak=>>>", "set linebreak", "set colorcolumn=10,+1",
    "set cursorline cursorcolumn", "set display=lastline", "set display=truncate",
    "set rightleft", "set norightleft",
  ].map((c) => `:${c}\r`),
);

// Undo: persistent undo files, undo files from other buffers, branches,
// time travel, and undo levels that throw history away.
const undo = keys(
  "g-", "g+", "5u", "3\x12", "U",
  ...[
    "set undofile undodir=.", "w", "e!", "wundo! u.dat", "rundo u.dat",
    "undo 1", "earlier 3", "later 99", "earlier 1h", "undojoin | normal! x",
    "set undolevels=2", "set undolevels=1000", "let &ul = &ul",
  ].map((c) => `:${c}\r`),
);

// Concealed text: syntax and match conceal with replacement characters,
// at every conceal level, also in the cursor line.
const conceal = keys(
  ...[
    "syntax match Conceal /[aeiou]/ conceal cchar=*", "syntax match Conceal /in/ conceal",
    "call matchadd('Conceal', 'e', 10, -1, {'conceal': '日'})", "call clearmatches()",
    "set conceallevel=1", "set conceallevel=2", "set conceallevel=3",
    "set concealcursor=nvic", "set concealcursor=",
  ].map((c) => `:${c}\r`),
);

// Counts on normal commands, and :normal over ranges with counts.
const counts = keys(
  "9999j", "50x", "5p", "3.", "7@a", "40\x0f", "99>>", "12J", "8~",
  ...[
    "1,20normal! 3J", ".,+5normal! 2x", "normal! 20.", "normal! 3@a",
    "exe \"normal! 5\\<C-A>\"", "g/e/normal! 2x", "%normal! 0d3l",
  ].map((c) => `:${c}\r`),
);

// Completion popups at the edges of the screen and in the command line,
// with options that squeeze or widen the menu.
const popup = keys(
  "G$a\x0e", "Lo\x0e\x0e", "$a\x18\x0c", "H$a\x0e", "z=",
  ":e \t\t", ":set \t\t\t", ":h buf\t", ":colorscheme \t\x0e", ":lua vim.api.nvim_\t\t",
  ...[
    "set pumheight=1", "set pumheight=0", "set pumwidth=150", "set pumblend=50",
    "set completeopt=menu,preview", "set completeopt=menuone,noselect,popup,fuzzy",
    "set wildoptions=pum", "set wildmode=longest:full,full", "set autocomplete",
    "set noautocomplete",
  ].map((c) => `:${c}\r`),
);

// Groups that type only ASCII.
const ascii: [number, ActionGenerator<ActionTemplate>][] = [
  [22, motions],
  [13, edits],
  [7, insert],
  [5, visual],
  [4, windows],
  [6, ex],
  [6, exDeep],
  [3, block],
  [3, completion],
  [2, terminal],
  [2, cmdwin],
  [4, marks],
  [3, diff],
  [4, layout],
  [3, undo],
  [3, counts],
  [3, popup],
  // Without Z, which starts ZZ and ZQ.
  [12, typePrintableExcept("Z")],
  [10, keys("\x1b")],
];

const sizes = weighted([
  [2, resize([20, 200], [5, 60])],
  // Very narrow or short, and very wide.
  [1, resize([1, 12], [1, 4])],
  [1, resize([200, 320], [50, 90])],
]);

const everywhere = weighted([
  ...ascii,
  [6, lua],
  [2, conceal],
  [3, typeFromSet(CharSets.UNICODE_SAFE)],
  [4, sizes],
]);
const asciiOnly = weighted([...ascii, [4, sizes]]);

// In terminal mode, keys go to bash, whose readline cuts multibyte
// characters in half when it scrolls a long line in a narrow window, or
// after a prefix key like Ctrl+X. Neovim then rightly shows U+FFFD for the
// stray bytes, so typing there stays ASCII. Narrow windows cut and
// garble the "-- TERMINAL --" mode message, and tiny ones hide it, so
// typing stays ASCII there too.
function maybeInTerminal(): boolean {
  const text = screen.current ?? "";
  const rows = text.split("\n");
  const tiny = rows.length < 4 || (rows[0] ?? "").length < 20;
  return tiny || /TERMIN/.test(text);
}

export const drive = pauseAfterEscape(
  new ActionGenerator(() =>
    (maybeInTerminal() ? asciiOnly : everywhere).generate()
  ),
);
