# cli-switch

**Launch and orchestrate multiple AI CLI tools in parallel tmux sessions.**

---

## Why

Modern developers use more than one AI coding assistant -- Claude Code, Gemini CLI, GitHub Copilot, AIChat, and the list keeps growing. Switching between terminal tabs is tedious, and there is no simple way to run them side-by-side, share context between them, or broadcast the same prompt to all of them at once.

cli-switch solves this by launching your chosen AI CLIs in a single tmux session with dedicated panes, a shared buffer for cross-pane copy/paste, broadcast messaging, synchronized typing, and a status bar showing every available keybinding.

---

## Features

- **Multi-tool launch** -- start Claude, Gemini, Copilot, and AIChat (or any subset) in one command.
- **Configurable layouts** -- side-by-side, stacked, tiled, main-horizontal, and main-vertical arrangements.
- **Shared buffer** -- capture output from any pane and paste it into another. The buffer is persisted to disk with timestamped history.
- **Broadcast** -- send the same prompt to every pane simultaneously, from a keybinding or from another terminal.
- **Synchronized typing** -- toggle sync mode so keystrokes go to all panes at once. A bright `SYNC ON` indicator appears in the status bar when active.
- **Clickable action menu** -- click anywhere on the status bar or press `Ctrl-b Space` to open a popup menu with all actions (capture, paste, broadcast, sync, kill, layout switching, and more).
- **Mouse support** -- click to focus a pane, drag to resize, scroll to review history.
- **Selective kill** -- kill individual panes by index or tool name without tearing down the whole session.
- **Status bar** -- styled bottom bar showing `[MENU]` button, session info, pane count, keybinding hints, sync indicator, and a clock.
- **YAML config file** -- set default tools, layout, session name, and keybindings in `.cli-switch.yaml`.
- **CLI subcommands** -- broadcast, capture, paste, kill, stop, and status commands usable from any terminal.

---

## How is this different?

| Tool | What it does | What cli-switch adds |
|---|---|---|
| **tmux** (raw) | Terminal multiplexer | cli-switch eliminates the manual setup -- no more split-pane, launch tools, configure keybindings every time |
| **aichat** | Multi-model CLI (switch models in one tool) | Single session, one model at a time. Cannot run models simultaneously or compare outputs side-by-side |
| **mods** (Charmbracelet) | Pipe-friendly AI CLI | Designed for scripting (`cat file \| mods "explain"`), not interactive parallel sessions |
| **fabric** | AI prompt chaining | Sequential prompt pipelines, not parallel interactive sessions |
| **aider** | AI pair programming | Deep git integration but single-model, not a multi-tool orchestrator |
| **Terminal tabs** | What most people do today | No cross-session communication, no shared buffer, everything manual |

**What cli-switch uniquely offers:**

- **Parallel interactive sessions** -- run Claude, Gemini, and Copilot simultaneously and see all responses at once
- **Cross-session communication** -- capture output from one AI and paste it as input to another
- **Broadcast** -- ask the same question to multiple AIs at once and compare answers
- **Zero lock-in** -- it does not wrap or replace any AI CLI, it just orchestrates them side-by-side

**When cli-switch shines:**

- Comparing AI outputs -- broadcast "write me a function" to 3 tools, pick the best answer
- Cross-review workflows -- Claude writes code, Copilot reviews it, Gemini researches the approach
- Team standardization -- everyone gets the same multi-tool setup with `.cli-switch.yaml` in the repo
- AI evaluation -- testing the same prompts across models systematically

**When you probably don't need it:**

- You only use one AI CLI
- You prefer IDE-integrated AI (Cursor, Copilot in VS Code)
- You don't need side-by-side comparison

---

## Quick Start

### Prerequisites

| Dependency | Minimum Version | Install |
|------------|-----------------|---------|
| Node.js    | 18.0+           | https://nodejs.org |
| tmux       | any recent      | `brew install tmux` (macOS) or `apt install tmux` (Linux) |

At least one supported AI CLI tool must be installed (see [Supported Tools](#supported-tools)).

### Install

**Option 1: Clone and link**

```bash
git clone https://github.com/nakurian/cli_switch.git
cd cli-switch
npm install
npm link
```

**Option 2: One-liner**

```bash
curl -fsSL https://raw.githubusercontent.com/nakurian/cli_switch/main/install.sh | bash
```

### Launch

```bash
cli-switch
```

This launches the default tool set (claude, gemini, copilot) in a tiled tmux layout. You will be attached to the session automatically.

---

## Usage

### Basic Launch Commands

```bash
# Launch all defaults (from config or claude + gemini + copilot)
cli-switch

# Launch specific tools
cli-switch claude gemini

# Choose a layout
cli-switch claude gemini copilot --layout horizontal
cli-switch claude gemini copilot --layout vertical
cli-switch claude gemini copilot --layout main-vertical

# Use a custom session name
cli-switch --session my-session
```

Available layouts: `horizontal` (side by side), `vertical` (stacked), `tiled` (default), `main-horizontal`, `main-vertical`. You can also switch layouts at any time from the action menu.

### Action Menu (easiest way)

**Click anywhere on the status bar** (the bottom bar) to open the action menu. You can also press `Ctrl-b Space` from the keyboard.

The menu provides one-click access to:

- Capture / Paste (shared buffer)
- Broadcast to all panes
- Toggle sync typing
- Kill pane / Quit all
- Switch layout (side by side, stacked, tiled)
- Detach

### Keybindings

All keybindings use the tmux prefix (default `Ctrl-b`), followed by the key listed below. These are also displayed in the status bar.

| Keybinding             | Action                                              |
|------------------------|-----------------------------------------------------|
| `Ctrl-b` + `Space`    | Open the action menu (same as clicking status bar)  |
| `Ctrl-b` + `S`        | Capture the last 50 lines from the active pane to the shared buffer |
| `Ctrl-b` + `P`        | Paste the shared buffer into the active pane        |
| `Ctrl-b` + `B`        | Open a prompt and broadcast the typed text to all panes |
| `Ctrl-b` + `Y`        | Toggle synchronized typing (keystrokes go to all panes) |
| `Ctrl-b` + `x`        | Kill the active pane                                |
| `Ctrl-b` + `Q`        | Quit the entire session (with confirmation prompt)  |
| `Ctrl-b` + `d`        | Detach from the session (keeps it running in the background) |
| `Ctrl-b` + arrow keys | Switch focus between panes                          |
| Click status bar       | Open the action menu                               |
| Click pane             | Select/focus a pane                                |
| Drag pane border       | Resize panes                                       |

When sync mode is active, a bright `SYNC ON` badge appears in the status bar. Press `Ctrl-b Y` again (or use the menu) to turn it off.

### CLI Commands from Another Terminal

While a cli-switch session is running, you can control it from a separate terminal window:

```bash
# Broadcast a prompt to every pane
cli-switch broadcast "review this code for security issues"

# Capture output from a specific pane (default: pane 0, last 50 lines)
cli-switch capture -p 0 -n 100

# Paste the shared buffer into a specific pane
cli-switch paste -p 1

# Kill a specific pane by index or tool name
cli-switch kill 0
cli-switch kill claude
cli-switch kill 0 2

# Kill all panes (tears down the session)
cli-switch kill all

# Stop the entire session
cli-switch stop

# Check session status and list active panes
cli-switch status
```

### Workflow Example

A typical cross-tool review workflow:

1. **Launch** Claude and Copilot side by side:
   ```bash
   cli-switch claude copilot --layout horizontal
   ```
2. **Ask Claude** (pane 0) to write a function.
3. **Capture** Claude's output: click the status bar and select "Capture to buffer" (or press `Ctrl-b S`).
4. **Switch** to Copilot's pane: click on it.
5. **Paste** the captured output: click the status bar and select "Paste from buffer" (or press `Ctrl-b P`).
6. **Ask Copilot** to review the pasted code.
7. Or skip the manual steps and **broadcast** the same question to both: use the menu's "Broadcast to all" (or press `Ctrl-b B`).

---

## Configuration

cli-switch looks for a `.cli-switch.yaml` file in the following locations (first match wins):

1. Current working directory: `./.cli-switch.yaml` or `./.cli-switch.yml`
2. Home directory: `~/.cli-switch.yaml` or `~/.cli-switch.yml`

If no config file is found, built-in defaults are used. CLI flags always override config file values.

### Example Configuration

```yaml
# cli-switch configuration

# Which AI CLI tools to launch (in order)
tools:
  - claude
  - gemini
  - copilot

# Layout: horizontal, vertical, tiled, main-horizontal, main-vertical
layout: tiled

# tmux session name
session_name: ai-switch

# Keybindings (used with tmux prefix, default Ctrl-b)
keybindings:
  capture: S
  paste: P
  broadcast: B
  sync_toggle: Y
```

### Configuration Precedence

Built-in defaults < `.cli-switch.yaml` file < CLI flags.

For example, if your config file sets `layout: vertical` but you run `cli-switch --layout tiled`, the tiled layout is used.

---

## Supported Tools

| Key       | Tool                    | Command    | Install                                                        |
|-----------|-------------------------|------------|----------------------------------------------------------------|
| `claude`  | Anthropic Claude Code   | `claude`   | https://docs.anthropic.com/en/docs/claude-code                 |
| `gemini`  | Google Gemini CLI       | `gemini`   | https://github.com/google-gemini/gemini-cli                    |
| `copilot` | GitHub Copilot CLI      | `copilot`  | `gh extension install github/gh-copilot`                       |
| `aichat`  | AIChat (multi-model)    | `aichat`   | https://github.com/sigoden/aichat                              |

cli-switch auto-detects which tools are installed. Tools that are not found on `PATH` are skipped with a warning.

---

## Adding Custom Tools

To add a new AI CLI tool, edit the `TOOL_REGISTRY` object in `src/tools.js`:

```js
const TOOL_REGISTRY = {
  // ... existing tools ...
  mytool: {
    name: 'MyTool',
    command: 'mytool',          // The command that launches the tool
    description: 'My custom AI CLI tool',
    color: '#FF6B6B',          // Color used for pane styling (hex)
  },
};
```

The `command` value must be an executable on your `PATH`. After adding the entry, you can launch it with:

```bash
cli-switch mytool claude
```

Or add it to your `.cli-switch.yaml`:

```yaml
tools:
  - claude
  - mytool
```

---

## How It Works

cli-switch is a thin orchestration layer built on top of [tmux](https://github.com/tmux/tmux).

1. **Session creation** -- `tmux new-session` creates a detached session, and `split-window` adds a pane for each requested tool. The configured layout (`select-layout`) arranges them.

2. **Tool launch** -- Each pane receives a `send-keys` command that starts the corresponding AI CLI (e.g., `claude`, `gemini`).

3. **Shared buffer** -- Capture (`capture-pane`) writes pane output to `~/.cli-switch/shared-buffer.txt`. Paste reads that file back via `load-buffer` and `paste-buffer`. Every capture is also saved with a timestamp in `~/.cli-switch/history/`.

4. **Broadcast** -- Iterates over all panes with `send-keys` to deliver the same prompt to each tool.

5. **Keybindings** -- Custom tmux key bindings are registered with `bind-key` at session startup. They invoke `run-shell` commands that perform capture, paste, and broadcast operations.

6. **Status bar** -- tmux `set-option` configures a styled status bar with a `[MENU]` button, session info, pane count, keybinding hints, a `SYNC ON` indicator, and a clock.

7. **Mouse** -- tmux mouse mode is enabled so you can click panes, drag borders, scroll, and click the status bar to open the action menu.

8. **Action menu** -- `display-menu` creates a popup menu triggered by clicking the status bar or pressing `Ctrl-b Space`. The menu provides all actions without needing to remember keybindings.

---

## Contributing

Contributions are welcome. To get started:

1. Fork the repository and create a feature branch.
2. Make your changes. Keep commits focused and well-described.
3. Run the test suite:
   ```bash
   npm test
   ```
4. Open a pull request with a clear description of what you changed and why.

Please follow the existing code style. The project uses ES modules (`"type": "module"` in `package.json`) and has no build step.

### Reporting Issues

If you encounter a bug or have a feature request, open an issue on GitHub with:
- Your OS and tmux version (`tmux -V`).
- Your Node.js version (`node -v`).
- Steps to reproduce the problem.

---

## License

MIT
