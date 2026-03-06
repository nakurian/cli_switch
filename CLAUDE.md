# cli-switch Development Guide

## Project Overview

cli-switch is a Node.js CLI tool that launches multiple AI CLI tools (Claude, Gemini, Copilot, etc.) in parallel tmux sessions with cross-session communication.

## Architecture

```
bin/cli-switch.js    → CLI entry point (commander.js), subcommands, launches tmux session
src/
  tools.js           → AI tool registry (name, command, detection). Add new tools here.
  config.js          → Config loader. Reads .cli-switch.yaml from cwd or home dir.
  tmux.js            → tmux primitives: session/pane create, kill, send-keys, capture-pane.
  bus.js             → Shared buffer (file-based) at ~/.cli-switch/shared-buffer.txt
  keybindings.js     → tmux keybinding setup, clickable action menu, status bar styling
  broadcast.js       → Send prompts to multiple panes
```

**Key design**: All inter-pane communication goes through tmux's `send-keys` (inject input) and `capture-pane` (grab output). The shared buffer is a plain file at `~/.cli-switch/shared-buffer.txt`.

## Code Conventions

- ES modules (`"type": "module"` in package.json)
- Node.js built-ins only for core functionality (fs, child_process, os, path)
- Single external dependency: `commander` for CLI parsing
- All tmux interaction goes through `execFileSync('tmux', args)` — never shell-interpolated
- Tool registry in `src/tools.js` — add new AI CLIs here with `command` and `name`

## Common Tasks

### Adding a new AI CLI tool
Edit `src/tools.js` → add entry to `TOOL_REGISTRY` with `name`, `command`, `description`, `color`.

### Changing keybindings
Edit defaults in `src/config.js` → `DEFAULTS.keybindings`. Users override via `.cli-switch.yaml`.

### Modifying the status bar
Edit `src/keybindings.js` → the status bar section uses tmux style directives (`#[fg=,bg=,bold]`).

### Modifying the action menu
Edit `src/keybindings.js` → the `menuCmd` array defines `display-menu` items. Format: `'Label', 'shortcut-key', 'tmux-command'`. Empty strings create separators. The menu is triggered by `MouseUp1Status*` (click status bar) and `prefix Space` (keyboard).

### Adding a new CLI subcommand
Add to `bin/cli-switch.js` using commander's `.command()` API. Import needed functions from src modules.

## Testing

Run `cli-switch` outside of tmux to test. Use `cli-switch stop` to clean up sessions.
Syntax check: `node --check bin/cli-switch.js && node --check src/*.js`

## Important Notes

- cli-switch MUST be run outside of tmux (it creates and attaches to its own session)
- tmux is a hard requirement — the tool will not work without it
- The shared buffer at `~/.cli-switch/` persists between sessions
- Pane indices shift when a pane is killed — the `kill` command handles this by killing in reverse order
- tmux layout names are counterintuitive: `even-horizontal` = side by side (|||), `even-vertical` = stacked (===). The UI uses visual labels to avoid confusion.
- Status bar mouse bindings use `MouseUp1` (not `MouseDown1`) to prevent the menu from closing immediately on click
- The `#{?synchronize-panes,...,}` conditional in the status bar shows/hides the SYNC ON indicator dynamically
