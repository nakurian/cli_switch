#!/usr/bin/env bash
set -e

# ---------------------------------------------------------------------------
# cli-switch installer
#
# Usage:
#   curl -fsSL <raw-url>/install.sh | bash        # install
#   curl -fsSL <raw-url>/install.sh | bash -s -- --uninstall   # uninstall
#   bash install.sh             # install from local clone
#   bash install.sh --uninstall # uninstall
# ---------------------------------------------------------------------------

REPO_URL="https://github.com/nakurian/cli_switch.git"
INSTALL_DIR="$HOME/.cli-switch"
BIN_NAME="cli-switch"
MIN_NODE_MAJOR=18

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

banner() {
    echo ""
    echo "============================================"
    echo "         cli-switch installer"
    echo "============================================"
    echo ""
}

info()  { echo "[info]  $*"; }
warn()  { echo "[warn]  $*"; }
error() { echo "[error] $*" >&2; }
die()   { error "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------

check_node() {
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js is not installed (>= $MIN_NODE_MAJOR required)."
        echo ""
        echo "  macOS:   brew install node"
        echo "  Linux:   Install via nvm (https://github.com/nvm-sh/nvm)"
        echo "           or: sudo apt install nodejs npm"
        echo ""
        exit 1
    fi

    node_version="$(node --version)"          # e.g. v20.11.0
    node_major="${node_version#v}"             # strip leading 'v'
    node_major="${node_major%%.*}"             # keep only the major number

    if [ "$node_major" -lt "$MIN_NODE_MAJOR" ] 2>/dev/null; then
        error "Node.js >= $MIN_NODE_MAJOR is required (found $node_version)."
        echo ""
        echo "  macOS:   brew upgrade node"
        echo "  Linux:   nvm install --lts"
        echo ""
        exit 1
    fi

    info "Node.js $node_version -- OK"
}

check_npm() {
    if ! command -v npm >/dev/null 2>&1; then
        error "npm is not available. It usually ships with Node.js."
        echo ""
        echo "  macOS:   brew install node"
        echo "  Linux:   sudo apt install npm"
        echo ""
        exit 1
    fi
    info "npm $(npm --version) -- OK"
}

check_tmux() {
    if ! command -v tmux >/dev/null 2>&1; then
        error "tmux is not installed."
        echo ""
        echo "  macOS:   brew install tmux"
        echo "  Linux:   sudo apt install tmux"
        echo ""
        exit 1
    fi
    info "tmux $(tmux -V | awk '{print $2}') -- OK"
}

check_git() {
    if ! command -v git >/dev/null 2>&1; then
        die "git is required but not found. Please install git first."
    fi
}

# ---------------------------------------------------------------------------
# Determine writable bin directory for the symlink
# ---------------------------------------------------------------------------

choose_bin_dir() {
    if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
        BIN_DIR="/usr/local/bin"
    else
        BIN_DIR="$HOME/.local/bin"
        mkdir -p "$BIN_DIR"
    fi
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

uninstall() {
    banner
    info "Uninstalling cli-switch ..."

    # Remove symlink from both possible locations
    for dir in /usr/local/bin "$HOME/.local/bin"; do
        if [ -L "$dir/$BIN_NAME" ]; then
            info "Removing symlink $dir/$BIN_NAME"
            rm -f "$dir/$BIN_NAME"
        fi
    done

    # Remove install directory
    if [ -d "$INSTALL_DIR" ]; then
        info "Removing $INSTALL_DIR"
        rm -rf "$INSTALL_DIR"
    else
        warn "$INSTALL_DIR does not exist; nothing to remove."
    fi

    echo ""
    info "cli-switch has been uninstalled."
    exit 0
}

# ---------------------------------------------------------------------------
# Install / Update
# ---------------------------------------------------------------------------

install() {
    banner

    # --- prerequisites ---
    info "Checking prerequisites ..."
    echo ""
    check_node
    check_npm
    check_tmux
    check_git
    echo ""

    # --- handle existing installation ---
    if [ -d "$INSTALL_DIR" ]; then
        echo "An existing installation was found at $INSTALL_DIR."
        echo ""
        echo "  [u] Update (git pull + npm install)"
        echo "  [r] Reinstall (remove and clone fresh)"
        echo "  [q] Quit"
        echo ""
        printf "Choose an option [u/r/q]: "
        read -r choice

        case "$choice" in
            u|U)
                info "Updating existing installation ..."
                cd "$INSTALL_DIR"
                git pull --ff-only || die "git pull failed. You may need to reinstall."
                npm install --production
                ;;
            r|R)
                info "Removing old installation ..."
                rm -rf "$INSTALL_DIR"
                info "Cloning repository ..."
                git clone "$REPO_URL" "$INSTALL_DIR"
                cd "$INSTALL_DIR"
                npm install --production
                ;;
            *)
                info "Aborted."
                exit 0
                ;;
        esac
    else
        # --- fresh install ---
        info "Cloning repository into $INSTALL_DIR ..."
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
        info "Installing dependencies ..."
        npm install --production
    fi

    # --- make the entry point executable ---
    chmod +x "$INSTALL_DIR/bin/$BIN_NAME.js"

    # --- create symlink ---
    choose_bin_dir
    info "Creating symlink in $BIN_DIR ..."
    ln -sf "$INSTALL_DIR/bin/$BIN_NAME.js" "$BIN_DIR/$BIN_NAME"

    # --- done ---
    echo ""
    echo "============================================"
    echo "  cli-switch installed successfully!"
    echo "============================================"
    echo ""
    echo "  Run 'cli-switch' to get started."
    echo ""

    # If we used ~/.local/bin, remind the user to add it to PATH
    if [ "$BIN_DIR" = "$HOME/.local/bin" ]; then
        case ":$PATH:" in
            *":$HOME/.local/bin:"*)
                # already on PATH -- nothing to say
                ;;
            *)
                echo "  NOTE: $BIN_DIR is not on your PATH."
                echo "  Add the following line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
                echo ""
                echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                echo ""
                echo "  Then restart your shell or run: source ~/.bashrc"
                echo ""
                ;;
        esac
    fi
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

case "${1:-}" in
    --uninstall)
        uninstall
        ;;
    --help|-h)
        echo "Usage: install.sh [--uninstall | --help]"
        echo ""
        echo "  (no flags)    Install or update cli-switch"
        echo "  --uninstall   Remove cli-switch from this machine"
        echo "  --help        Show this help message"
        exit 0
        ;;
    "")
        install
        ;;
    *)
        die "Unknown option: $1 (use --help for usage)"
        ;;
esac
