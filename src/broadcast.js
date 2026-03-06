/**
 * Broadcast functionality — send the same prompt to multiple panes.
 * Used by the CLI for non-interactive broadcast (cli-switch broadcast "prompt").
 */

import { sendKeys, sendKeysAllPanes, getPaneCount } from './tmux.js';

/**
 * Send a message to all panes in the session.
 */
export function broadcastToAll(sessionName, message) {
  sendKeysAllPanes(sessionName, message);
}

/**
 * Send a message to specific panes by index.
 */
export function broadcastToSelected(sessionName, paneIndices, message) {
  for (const idx of paneIndices) {
    sendKeys(sessionName, idx, message);
  }
}

/**
 * Get info about active panes for display.
 */
export function getPaneInfo(sessionName) {
  const count = getPaneCount(sessionName);
  return { count, sessionName };
}
