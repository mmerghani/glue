#!/bin/bash
# Glue bootstrap installer
# Keeps upstream repos intact and installs the current source-controlled launcher.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLUE_HOME="$HOME/.glue"
GLUE_LAUNCHER="$GLUE_HOME/glue"
GLUE_LAUNCHER_SOURCE="$SCRIPT_DIR/launchers/glue"
GLUE_SOURCE_DIR="$SCRIPT_DIR/glue-source"
CLAUDE_CODE_LOCAL_DIR="$HOME/claude-code-local"
CLAUDE_CODE_LOCAL_REPO="${CLAUDE_CODE_LOCAL_REPO:-https://github.com/vitorallo/claude-code-local.git}"
USER_BIN_DIR="$HOME/.local/bin"
GLOBAL_BIN_CANDIDATES=("/usr/local/bin" "/opt/homebrew/bin")
USED_LINK_PATH=""
WITH_DESKTOP_DEPS=0
INSTALLED_DESKTOP_DEPS=0

info() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf 'Warning: %s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

show_help() {
  cat <<'HELP'
Glue installer

Usage:
  ./install.sh [--with-desktop-deps]

Options:
  --with-desktop-deps   Prepares glue-source/ for local desktop development
  -h, --help            Show this help message

Optional environment overrides:
  CLAUDE_CODE_LOCAL_REPO   Alternate claude-code-local git URL

What it does:
  1. Verifies Apple Silicon + Homebrew prerequisites
  2. Installs Node.js, Git, and Claude Code CLI if needed
  3. Clones or updates ~/claude-code-local and runs its upstream install.sh
  4. Copies launchers/glue into ~/.glue/glue and links it into your PATH
  5. Optionally runs npm install in glue-source/ for local desktop work
HELP
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --with-desktop-deps)
        WITH_DESKTOP_DEPS=1
        ;;
      -h|--help|help)
        show_help
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
    shift
  done
}

ensure_apple_silicon() {
  [[ "$(uname -m)" == "arm64" ]] || fail "Glue currently targets Apple Silicon because claude-code-local uses vllm-mlx."
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi

  info "Installing Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
}

load_homebrew_env() {
  if ! command -v brew >/dev/null 2>&1; then
    fail "Homebrew is required but could not be found after installation."
  fi

  local brew_prefix
  brew_prefix="$(brew --prefix)"
  export PATH="$brew_prefix/bin:$brew_prefix/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
}

ensure_brew_package() {
  local package="$1"
  if brew list "$package" >/dev/null 2>&1; then
    return
  fi

  info "Installing $package"
  brew install "$package"
}

ensure_claude_cli() {
  if command -v claude >/dev/null 2>&1; then
    return
  fi

  info "Installing Claude Code CLI"
  npm install -g @anthropic-ai/claude-code
}

update_or_clone_claude_code_local() {
  if [[ -d "$CLAUDE_CODE_LOCAL_DIR/.git" ]]; then
    info "Refreshing claude-code-local"
    if git -C "$CLAUDE_CODE_LOCAL_DIR" diff --quiet && git -C "$CLAUDE_CODE_LOCAL_DIR" diff --cached --quiet; then
      git -C "$CLAUDE_CODE_LOCAL_DIR" pull --ff-only
    else
      warn "Skipping git pull for ~/claude-code-local because it has local changes."
    fi
  elif [[ -e "$CLAUDE_CODE_LOCAL_DIR" ]]; then
    fail "~/claude-code-local exists but is not a git checkout. Move it or remove it first."
  else
    info "Cloning claude-code-local"
    git clone "$CLAUDE_CODE_LOCAL_REPO" "$CLAUDE_CODE_LOCAL_DIR"
  fi

  info "Running claude-code-local/install.sh"
  (cd "$CLAUDE_CODE_LOCAL_DIR" && ./install.sh)
}

install_desktop_dependencies() {
  if [[ "$WITH_DESKTOP_DEPS" != "1" ]]; then
    return
  fi

  if [[ ! -f "$GLUE_SOURCE_DIR/package.json" ]]; then
    warn "Skipping desktop dependency install because glue-source/package.json was not found."
    return
  fi

  info "Installing Glue desktop dependencies"
  (cd "$GLUE_SOURCE_DIR" && npm install)
  INSTALLED_DESKTOP_DEPS=1
}

link_launcher() {
  local candidate

  mkdir -p "$GLUE_HOME"
  cp "$GLUE_LAUNCHER_SOURCE" "$GLUE_LAUNCHER"
  chmod +x "$GLUE_LAUNCHER"

  for candidate in "${GLOBAL_BIN_CANDIDATES[@]}"; do
    if [[ -d "$candidate" && -w "$candidate" ]]; then
      ln -sf "$GLUE_LAUNCHER" "$candidate/glue"
      USED_LINK_PATH="$candidate/glue"
      return
    fi

    if command -v sudo >/dev/null 2>&1; then
      if sudo -n true >/dev/null 2>&1; then
        sudo ln -sf "$GLUE_LAUNCHER" "$candidate/glue"
        USED_LINK_PATH="$candidate/glue"
        return
      fi
    fi
  done

  mkdir -p "$USER_BIN_DIR"
  ln -sf "$GLUE_LAUNCHER" "$USER_BIN_DIR/glue"
  USED_LINK_PATH="$USER_BIN_DIR/glue"
}

print_summary() {
  info "Glue install complete"
  printf 'Launcher: %s\n' "$USED_LINK_PATH"
  printf 'Backend:  %s\n' "$CLAUDE_CODE_LOCAL_DIR/run.sh"
  if [[ "$INSTALLED_DESKTOP_DEPS" == "1" ]]; then
    printf 'Desktop:  %s (npm install complete)\n' "$GLUE_SOURCE_DIR"
  fi
  printf '\nTry these next:\n'
  printf '  glue status\n'
  printf '  glue cli\n'
  printf '  glue ui\n'

  if [[ -f "$GLUE_SOURCE_DIR/package.json" && "$INSTALLED_DESKTOP_DEPS" != "1" ]]; then
    printf '\nFor desktop development or local packaging:\n'
    printf '  cd "%s"\n' "$GLUE_SOURCE_DIR"
    printf '  npm install\n'
    printf '  npm run desktop:dist:mac\n'
  fi

  case ":$PATH:" in
    *":$USER_BIN_DIR:"*) ;;
    *)
      if [[ "$USED_LINK_PATH" == "$USER_BIN_DIR/glue" ]]; then
        printf '\nAdd this to your shell profile if needed:\n'
        printf '  export PATH="%s:$PATH"\n' "$USER_BIN_DIR"
      fi
      ;;
  esac
}

main() {
  parse_args "$@"
  [[ -f "$GLUE_LAUNCHER_SOURCE" ]] || fail "Launcher source not found at $GLUE_LAUNCHER_SOURCE"

  ensure_apple_silicon
  ensure_homebrew
  load_homebrew_env
  ensure_brew_package git
  ensure_brew_package node
  ensure_claude_cli
  update_or_clone_claude_code_local
  install_desktop_dependencies
  link_launcher
  print_summary
}

main "$@"
