# Fuzz harness for Neovim.
#
# Neovim runs shell commands (`:!`, `:terminal`) and writes files, so
# campaigns run in the Nix sandbox. Every run starts `nvim --clean` on a
# fresh copy of a seed directory, with no user config or plugins.
{
  pkgs,
  zoo,
  ...
}:
let
  seed = pkgs.runCommand "neovim-seed" { } ''
    mkdir -p $out/src && cd $out
    cat > src/main.c <<'EOF'
    #include <stdio.h>

    /* A comment with ünïcödé and 日本語. */
    int main(int argc, char **argv) {
      for (int i = 0; i < argc; i++) {
        printf("%d: %s\n", i, argv[i]);
      }
      return 0;
    }
    EOF
    cat > src/app.py <<'EOF'
    def fib(n):
        """Return the n-th Fibonacci number."""
        return n if n < 2 else fib(n - 1) + fib(n - 2)


    class Thing:
        def __init__(self, name: str) -> None:
            self.name = name  # trailing comment
    EOF
    printf '# Title\n\n- item\n- ünïcödé item\n\n```sh\necho hi\n```\n' > README.md
    printf '{"key": [1, 2, {"nested": true}], "s": "日本語"}\n' > data.json
    # Large and long: 100k lines, and lines far wider than the screen.
    seq 1 100000 | sed 's/$/ some text on every line ─── ünïcödé/' > big.txt
    for i in $(seq 1 50); do printf 'x%.0s' $(seq 1 2000); echo " $i"; done > long-lines.txt
    # Content editors handle specially.
    printf 'mixed\tindent\n    spaces\n\ttabs\n' > whitespace.txt
    printf 'crlf line\r\nanother\r\n' > crlf.txt
    head -c 4096 /dev/urandom > blob.bin
    : > empty.txt
  '';

  launch = zoo.launchInCopy {
    name = "neovim";
    inherit seed;
    # -n: no swap files, so runs don't trip over each other's recovery.
    command = "${pkgs.neovim}/bin/nvim --clean -n src/main.c src/app.py README.md big.txt";
    env = {
      HOME = ''"$work"'';
      XDG_STATE_HOME = ''"$work/.local/state"'';
      XDG_DATA_HOME = ''"$work/.local/share"'';
      SHELL = "${pkgs.bash}/bin/bash";
    };
  };
in
zoo.sandboxed {
  name = "neovim";
  inherit launch;
  inputs = [ pkgs.coreutils ];
}
// {
  packages.neovim-seed = seed;

  devShell = pkgs.mkShell { packages = [ pkgs.neovim ]; };
}
