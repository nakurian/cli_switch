/**
 * Sets up custom tmux keybindings for cross-pane communication.
 *
 * Keybindings (all prefixed with tmux prefix, default Ctrl-b):
 *   prefix + S  → Capture last 50 lines from current pane → shared buffer
 *   prefix + P  → Paste shared buffer contents into current pane
 *   prefix + B  → Open a prompt, broadcast typed text to ALL panes
 *   prefix + Y  → Toggle synchronize-panes (type in all panes simultaneously)
 */

import { execFileSync } from 'node:child_process';
import { getBufferPath, getBusDir } from './bus.js';

function tmux(...args) {
  execFileSync('tmux', args, { encoding: 'utf-8' });
}

export function setupKeybindings(sessionName, config) {
  const keys = config.keybindings;
  const bufferPath = getBufferPath();
  const busDir = getBusDir();
  const helperScript = `${busDir}/broadcast.sh`;

  // Enable mouse support — click to select panes, drag to resize, scroll
  tmux('set-option', '-t', sessionName, 'mouse', 'on');

  // Capture: grab last 50 lines from active pane → shared buffer file
  // Then display a brief message confirming capture
  tmux(
    'bind-key', '-T', 'prefix', keys.capture,
    'run-shell',
    `tmux capture-pane -p -S -50 > ${bufferPath} && tmux display-message "Captured to shared buffer"`
  );

  // Paste: read shared buffer and send it as input to the current pane
  // Uses load-buffer + paste-buffer for clean multi-line support
  tmux(
    'bind-key', '-T', 'prefix', keys.paste,
    'run-shell',
    `tmux load-buffer ${bufferPath} && tmux paste-buffer && tmux display-message "Pasted from shared buffer"`
  );

  // Broadcast: prompt for input, then send to all panes
  tmux(
    'bind-key', '-T', 'prefix', keys.broadcast,
    'command-prompt', '-p', 'Broadcast to all panes:',
    `run-shell "tmux list-panes -t ${sessionName}:ai -F '#{pane_index}' | while read idx; do tmux send-keys -t ${sessionName}:ai.\${idx} '%1' Enter; done && tmux display-message 'Broadcast sent'"`
  );

  // Sync toggle: synchronize-panes lets you type in ALL panes at once
  tmux(
    'bind-key', '-T', 'prefix', keys.sync_toggle,
    'set-window-option', 'synchronize-panes'
  );

  // Quit: kill the entire session (with confirmation)
  tmux(
    'bind-key', '-T', 'prefix', 'Q',
    'confirm-before', '-p', 'Kill all AI sessions? (y/n)',
    `kill-session -t ${sessionName}`
  );

  // --- Popup action menu ---
  // Gives mouse-friendly access to all actions without remembering keybindings.

  const menuCmd = [
    'display-menu', '-T', '#[fg=#6c5ce7,bold] cli-switch actions ', '-x', 'R', '-y', 'S',
    'Capture to buffer'    , 'S', `run-shell "tmux capture-pane -p -S -50 > ${bufferPath} && tmux display-message \\"Captured to shared buffer\\""`,
    'Paste from buffer'    , 'P', `run-shell "tmux load-buffer ${bufferPath} && tmux paste-buffer && tmux display-message \\"Pasted from shared buffer\\""`,
    ''                     , '' , '',  // separator
    'Broadcast to all'     , 'B', `command-prompt -p "Broadcast:" "run-shell \\"tmux list-panes -t ${sessionName}:ai -F '#{pane_index}' | while read idx; do tmux send-keys -t ${sessionName}:ai.\\$idx '%1' Enter; done && tmux display-message 'Broadcast sent'\\""`,
    'Toggle sync typing'   , 'Y', 'set-window-option synchronize-panes',
    ''                     , '' , '',  // separator
    'Kill this pane'       , 'x', 'confirm-before -p "Kill this pane? (y/n)" kill-pane',
    'Quit all'             , 'Q', `confirm-before -p "Kill all sessions? (y/n)" "kill-session -t ${sessionName}"`,
    ''                     , '' , '',  // separator
    'Side by side  |||'    , 'h', 'select-layout even-horizontal',
    'Stacked       ==='   , 'v', 'select-layout even-vertical',
    'Tiled          #'     , 't', 'select-layout tiled',
    ''                     , '' , '',  // separator
    'Detach (keep running)', 'd', 'detach-client',
  ];

  // Click anywhere on the status bar → popup menu
  // Use MouseUp (not MouseDown) so the release event doesn't immediately close the menu.
  // Bind MouseDown to a no-op to suppress default status bar behavior.
  tmux('bind-key', '-n', 'MouseDown1StatusLeft', 'send-keys', '');
  tmux('bind-key', '-n', 'MouseDown1StatusRight', 'send-keys', '');
  tmux('bind-key', '-n', 'MouseDown1Status', 'send-keys', '');
  tmux('bind-key', '-n', 'MouseUp1StatusLeft', ...menuCmd);
  tmux('bind-key', '-n', 'MouseUp1StatusRight', ...menuCmd);
  tmux('bind-key', '-n', 'MouseUp1Status', ...menuCmd);

  // Keyboard shortcut for the menu: prefix + Space
  tmux('bind-key', '-T', 'prefix', 'Space', ...menuCmd);

  // --- Status bar styling ---

  // Base status bar
  tmux('set-option', '-t', sessionName, 'status', 'on');
  tmux('set-option', '-t', sessionName, 'status-style', 'bg=#1a1a2e,fg=#a0a0b0');
  tmux('set-option', '-t', sessionName, 'status-position', 'bottom');

  // Increase status bar width limits
  tmux('set-option', '-t', sessionName, 'status-left-length', '40');
  tmux('set-option', '-t', sessionName, 'status-right-length', '120');

  // Left: clickable menu button + session + pane count
  const statusLeft = [
    '#[bg=#6c5ce7,fg=#ffffff,bold] [MENU] cli-switch ',
    '#[bg=#3d3565,fg=#c8c8d0] #{session_name} ',
    '#[bg=#2a2745,fg=#8a8aad] #{window_panes} panes ',
    '#[bg=#1a1a2e,fg=#2a2745]',
  ].join('');
  tmux('set-option', '-t', sessionName, 'status-left', statusLeft);

  // Right: sync indicator + keybinding hints + right-click hint + clock
  const statusRight = [
    '#{?synchronize-panes,#[bg=#e17055,fg=#ffffff,bold] SYNC ON ,}',
    '#[bg=#1a1a2e,fg=#2a2745]',
    '#[bg=#2a2745,fg=#74b9ff] S#[fg=#636e85]:cap ',
    '#[fg=#74b9ff]P#[fg=#636e85]:paste ',
    '#[fg=#a29bfe]B#[fg=#636e85]:bcast ',
    '#[fg=#a29bfe]Y#[fg=#636e85]:sync ',
    '#[bg=#2d2548,fg=#fd79a8] x#[fg=#7c6fad]:kill ',
    '#[fg=#fd79a8]Q#[fg=#7c6fad]:quit ',
    '#[bg=#6c5ce7,fg=#ffffff,bold] [MENU] ',
    '#[bg=#2d4a3e,fg=#55efc4] %H:%M ',
  ].join('');
  tmux('set-option', '-t', sessionName, 'status-right', statusRight);

  // Window status (the tab in the middle)
  tmux('set-option', '-t', sessionName, 'window-status-current-format',
    '#[bg=#2d2d4e,fg=#dfe6e9,bold] #{window_index}:#{window_name} #[default]');
  tmux('set-option', '-t', sessionName, 'window-status-format',
    '#[fg=#636e85] #{window_index}:#{window_name} ');
  tmux('set-option', '-t', sessionName, 'status-justify', 'centre');

  // Pane borders — colored and labeled
  tmux('set-option', '-t', sessionName, 'pane-border-status', 'top');
  tmux('set-option', '-t', sessionName, 'pane-border-style', 'fg=#3d3565');
  tmux('set-option', '-t', sessionName, 'pane-active-border-style', 'fg=#6c5ce7');
  tmux('set-option', '-t', sessionName, 'pane-border-format',
    '#[fg=#636e85] #{pane_index} #[fg=#a29bfe,bold]#{pane_title}#[default] #{?pane_active,#[fg=#55efc4]<active>,}');
}
