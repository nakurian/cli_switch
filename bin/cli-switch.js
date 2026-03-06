#!/usr/bin/env node

import { program } from 'commander';
import { loadConfig } from '../src/config.js';
import { getInstalledTools, getToolNames } from '../src/tools.js';
import { execFileSync } from 'node:child_process';
import {
  isTmuxInstalled,
  isInsideTmux,
  sessionExists,
  createSession,
  attachSession,
  killSession,
  killPane,
  listPaneProcesses,
  capturePane,
  sendKeys,
} from '../src/tmux.js';
import { setupKeybindings } from '../src/keybindings.js';
import { writeBuffer, readBuffer } from '../src/bus.js';
import { broadcastToAll } from '../src/broadcast.js';

program
  .name('cli-switch')
  .description('Launch multiple AI CLI tools in parallel tmux sessions with cross-session communication')
  .version('0.1.0');

// Main launch command (default)
program
  .argument('[tools...]', `AI tools to launch (${getToolNames().join(', ')})`)
  .option('-l, --layout <layout>', 'tmux layout: horizontal, vertical, tiled, main-horizontal, main-vertical', 'tiled')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .action((tools, opts) => {
    launch(tools, opts);
  });

// Broadcast subcommand
program
  .command('broadcast <message>')
  .description('Send a prompt to all active panes')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .action((message, opts) => {
    if (!sessionExists(opts.session)) {
      console.error(`No active session "${opts.session}". Launch first with: cli-switch`);
      process.exit(1);
    }
    broadcastToAll(opts.session, message);
    console.log(`Broadcast sent to all panes in session "${opts.session}"`);
  });

// Capture subcommand
program
  .command('capture')
  .description('Capture output from a specific pane to the shared buffer')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .option('-p, --pane <index>', 'pane index to capture from', '0')
  .option('-n, --lines <count>', 'number of lines to capture', '50')
  .action((opts) => {
    if (!sessionExists(opts.session)) {
      console.error(`No active session "${opts.session}".`);
      process.exit(1);
    }
    const output = capturePane(opts.session, parseInt(opts.pane), parseInt(opts.lines));
    writeBuffer(output);
    console.log(`Captured ${opts.lines} lines from pane ${opts.pane} to shared buffer.`);
  });

// Paste subcommand
program
  .command('paste')
  .description('Paste the shared buffer into a specific pane')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .option('-p, --pane <index>', 'pane index to paste into', '0')
  .action((opts) => {
    if (!sessionExists(opts.session)) {
      console.error(`No active session "${opts.session}".`);
      process.exit(1);
    }
    const content = readBuffer();
    if (!content) {
      console.error('Shared buffer is empty. Capture first with: cli-switch capture');
      process.exit(1);
    }
    sendKeys(opts.session, parseInt(opts.pane), content);
    console.log(`Pasted shared buffer into pane ${opts.pane}.`);
  });

// Kill subcommand — kill specific pane(s)
program
  .command('kill [targets...]')
  .description('Kill specific panes by index (0,1,2) or tool name (claude,gemini,copilot), or "all"')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .action((targets, opts) => {
    if (!sessionExists(opts.session)) {
      console.error(`No active session "${opts.session}".`);
      process.exit(1);
    }

    // Show panes if no target specified
    if (!targets.length) {
      const panes = listPaneProcesses(opts.session);
      console.log('Active panes:');
      for (const p of panes) {
        console.log(`  ${p.index}: ${p.command}`);
      }
      console.log('\nUsage: cli-switch kill <index|name|all>');
      console.log('  cli-switch kill 0          Kill pane 0');
      console.log('  cli-switch kill claude      Kill pane running claude');
      console.log('  cli-switch kill 0 2         Kill panes 0 and 2');
      console.log('  cli-switch kill all         Kill all panes (same as stop)');
      return;
    }

    // Handle "all"
    if (targets.includes('all')) {
      killSession(opts.session);
      console.log(`All panes killed. Session "${opts.session}" stopped.`);
      return;
    }

    const panes = listPaneProcesses(opts.session);

    // Resolve targets to pane indices (support both index and tool name)
    const indicesToKill = [];
    for (const target of targets) {
      const asNumber = parseInt(target);
      if (!isNaN(asNumber)) {
        if (panes.some(p => p.index === asNumber)) {
          indicesToKill.push(asNumber);
        } else {
          console.warn(`Pane ${asNumber} does not exist. Skipping.`);
        }
      } else {
        // Match by tool/command name
        const match = panes.find(p =>
          p.command.toLowerCase().includes(target.toLowerCase())
        );
        if (match) {
          indicesToKill.push(match.index);
        } else {
          console.warn(`No pane found running "${target}". Skipping.`);
        }
      }
    }

    // Kill in reverse order so indices don't shift
    indicesToKill.sort((a, b) => b - a);
    for (const idx of indicesToKill) {
      killPane(opts.session, idx);
      console.log(`Killed pane ${idx}.`);
    }
  });

// Stop subcommand
program
  .command('stop')
  .description('Kill the cli-switch tmux session')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .action((opts) => {
    if (!sessionExists(opts.session)) {
      console.log(`No active session "${opts.session}".`);
      return;
    }
    killSession(opts.session);
    console.log(`Session "${opts.session}" stopped.`);
  });

// Status subcommand
program
  .command('status')
  .description('Show status of the current cli-switch session')
  .option('-s, --session <name>', 'tmux session name', 'ai-switch')
  .action((opts) => {
    if (!sessionExists(opts.session)) {
      console.log(`No active session "${opts.session}".`);
      return;
    }
    console.log(`Session "${opts.session}" is running.`);
    try {
      const panes = execFileSync('tmux', [
        'list-panes', '-t', `${opts.session}:ai`, '-F',
        '  Pane #{pane_index}: #{pane_current_command} (#{pane_width}x#{pane_height})#{?pane_active, [active],}'
      ], { encoding: 'utf-8' });
      console.log(panes.trim());
    } catch {
      // Fallback if pane listing fails
    }
  });

program.parse();

// --- Core logic ---

function launch(toolArgs, opts) {
  // Preflight checks
  if (!isTmuxInstalled()) {
    console.error('tmux is required but not installed.');
    console.error('Install it with: brew install tmux (macOS) or apt install tmux (Linux)');
    process.exit(1);
  }

  if (isInsideTmux()) {
    console.error('You are already inside a tmux session.');
    console.error('Please run cli-switch from outside tmux, or detach first (prefix + d).');
    process.exit(1);
  }

  // Load config and merge with CLI args
  const config = loadConfig({
    tools: toolArgs.length > 0 ? toolArgs : undefined,
    layout: opts.layout,
    sessionName: opts.session,
  });

  // Validate and filter tools
  const tools = getInstalledTools(config.tools);
  if (tools.length === 0) {
    console.error('No valid AI CLI tools found. Install at least one of:');
    console.error('  claude  → https://docs.anthropic.com/en/docs/claude-code');
    console.error('  gemini  → npm install -g @anthropic-ai/gemini-cli');
    console.error('  copilot → gh extension install github/gh-copilot');
    process.exit(1);
  }

  console.log(`Launching ${tools.map(t => t.name).join(', ')} in ${config.layout} layout...`);

  // Create tmux session with panes
  createSession(config.session_name, tools, config.layout);

  // Set up keybindings for cross-pane communication
  setupKeybindings(config.session_name, config);

  console.log('');
  console.log('  Click the status bar or press Ctrl-b Space to open the action menu.');
  console.log('');
  console.log('Keybindings (prefix = Ctrl-b):');
  console.log('  prefix + Space → Action menu (capture, paste, broadcast, layout, etc.)');
  console.log(`  prefix + ${config.keybindings.capture}      → Capture pane output to shared buffer`);
  console.log(`  prefix + ${config.keybindings.paste}      → Paste shared buffer into current pane`);
  console.log(`  prefix + ${config.keybindings.broadcast}      → Broadcast a prompt to ALL panes`);
  console.log(`  prefix + ${config.keybindings.sync_toggle}      → Toggle synchronized typing (all panes)`);
  console.log('  prefix + Q      → Quit entire session (with confirmation)');
  console.log('  prefix + d      → Detach (keep running in background)');
  console.log('');

  // Attach to the session (hands over terminal)
  attachSession(config.session_name);
}
