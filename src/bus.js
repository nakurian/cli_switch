/**
 * Shared buffer (bus) for cross-pane communication.
 * Captures output from one pane, stores in a shared file,
 * and can paste it into another pane.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BUS_DIR = join(homedir(), '.cli-switch');
const BUFFER_FILE = join(BUS_DIR, 'shared-buffer.txt');
const HISTORY_DIR = join(BUS_DIR, 'history');

function ensureDirs() {
  mkdirSync(BUS_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });
}

/**
 * Save captured text to the shared buffer.
 */
export function writeBuffer(text) {
  ensureDirs();
  writeFileSync(BUFFER_FILE, text, 'utf-8');

  // Also save to history with timestamp
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(HISTORY_DIR, `buffer-${ts}.txt`), text, 'utf-8');
}

/**
 * Read the current shared buffer contents.
 */
export function readBuffer() {
  if (!existsSync(BUFFER_FILE)) return '';
  return readFileSync(BUFFER_FILE, 'utf-8');
}

/**
 * Get the path to the shared buffer file.
 * Useful for tmux keybindings that need to reference it.
 */
export function getBufferPath() {
  ensureDirs();
  return BUFFER_FILE;
}

export function getBusDir() {
  ensureDirs();
  return BUS_DIR;
}
