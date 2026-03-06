/**
 * tmux session and pane management.
 * Creates, controls, and queries tmux sessions for AI CLI tools.
 */

import { execSync, execFileSync } from 'node:child_process';

function tmux(...args) {
  try {
    return execFileSync('tmux', args, { encoding: 'utf-8' }).trim();
  } catch (err) {
    if (err.stderr) throw new Error(err.stderr.toString().trim());
    throw err;
  }
}

export function isTmuxInstalled() {
  try {
    execSync('which tmux', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isInsideTmux() {
  return !!process.env.TMUX;
}

export function sessionExists(sessionName) {
  try {
    tmux('has-session', '-t', sessionName);
    return true;
  } catch {
    return false;
  }
}

export function killSession(sessionName) {
  try {
    tmux('kill-session', '-t', sessionName);
  } catch {
    // Session may not exist, that's fine
  }
}

/**
 * Create a new tmux session with panes for each tool.
 * Returns the session name.
 */
export function createSession(sessionName, tools, layout) {
  if (sessionExists(sessionName)) {
    killSession(sessionName);
  }

  // Create session with first tool
  const firstTool = tools[0];
  tmux(
    'new-session',
    '-d',
    '-s', sessionName,
    '-n', 'ai',
    '-x', '200',
    '-y', '50',
  );

  // Name the first pane and send the tool command
  const firstPane = `${sessionName}:ai.0`;
  tmux('select-pane', '-t', firstPane, '-T', firstTool.name);
  tmux('send-keys', '-t', firstPane, firstTool.command, 'Enter');

  // Create additional panes for remaining tools
  for (let i = 1; i < tools.length; i++) {
    const tool = tools[i];
    const splitDir = layout === 'horizontal' ? '-v' : '-h';
    tmux('split-window', splitDir, '-t', `${sessionName}:ai`);
    const paneId = `${sessionName}:ai.${i}`;
    tmux('select-pane', '-t', paneId, '-T', tool.name);
    tmux('send-keys', '-t', paneId, tool.command, 'Enter');
  }

  // Apply layout
  const tmuxLayout = mapLayout(layout, tools.length);
  tmux('select-layout', '-t', `${sessionName}:ai`, tmuxLayout);

  // When a tool exits, close its pane automatically.
  // When all panes close, the window (and session) dies naturally.
  tmux('set-option', '-t', sessionName, 'remain-on-exit', 'off');

  // Select first pane
  tmux('select-pane', '-t', `${sessionName}:ai.0`);

  return sessionName;
}

function mapLayout(layout, paneCount) {
  switch (layout) {
    case 'horizontal': return 'even-horizontal';
    case 'vertical': return 'even-vertical';
    case 'tiled': return 'tiled';
    case 'main-horizontal': return 'main-horizontal';
    case 'main-vertical': return 'main-vertical';
    default: return paneCount <= 2 ? 'even-horizontal' : 'tiled';
  }
}

export function attachSession(sessionName) {
  // Use execSync with stdio inherit to hand over terminal
  try {
    execSync(`tmux attach-session -t ${sessionName}`, { stdio: 'inherit' });
  } catch {
    // User detached or session ended — normal exit
  }
}

export function listPanes(sessionName) {
  const output = tmux(
    'list-panes',
    '-t', `${sessionName}:ai`,
    '-F', '#{pane_index}:#{pane_title}:#{pane_current_command}:#{pane_active}'
  );
  return output.split('\n').map(line => {
    const [index, title, command, active] = line.split(':');
    return { index: parseInt(index), title, command, active: active === '1' };
  });
}

export function getPaneCount(sessionName) {
  const output = tmux(
    'list-panes',
    '-t', `${sessionName}:ai`,
    '-F', '#{pane_index}'
  );
  return output.split('\n').length;
}

export function sendKeys(sessionName, paneIndex, keys) {
  tmux('send-keys', '-t', `${sessionName}:ai.${paneIndex}`, keys, 'Enter');
}

export function sendKeysAllPanes(sessionName, keys) {
  const count = getPaneCount(sessionName);
  for (let i = 0; i < count; i++) {
    tmux('send-keys', '-t', `${sessionName}:ai.${i}`, keys, 'Enter');
  }
}

export function killPane(sessionName, paneIndex) {
  tmux('kill-pane', '-t', `${sessionName}:ai.${paneIndex}`);
}

export function listPaneProcesses(sessionName) {
  try {
    const output = tmux(
      'list-panes',
      '-t', `${sessionName}:ai`,
      '-F', '#{pane_index}:#{pane_current_command}'
    );
    return output.split('\n').map(line => {
      const [index, command] = line.split(':');
      return { index: parseInt(index), command };
    });
  } catch {
    return [];
  }
}

export function capturePane(sessionName, paneIndex, lineCount = 50) {
  return tmux(
    'capture-pane',
    '-t', `${sessionName}:ai.${paneIndex}`,
    '-p',             // print to stdout
    '-S', `-${lineCount}` // start N lines back from cursor
  );
}
