/**
 * Configuration loader.
 * Looks for .cli-switch.yaml in cwd, then home directory, then uses defaults.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULTS = {
  tools: ['claude', 'gemini', 'copilot'],
  layout: 'tiled',
  session_name: 'ai-switch',
  shared_buffer_dir: join(homedir(), '.cli-switch'),
  keybindings: {
    capture: 'S',    // prefix + S  → capture current pane output
    paste: 'P',      // prefix + P  → paste shared buffer into pane
    broadcast: 'B',  // prefix + B  → broadcast prompt to all panes
    sync_toggle: 'Y', // prefix + Y → toggle synchronize-panes
  },
};

/**
 * Minimal YAML parser for simple key-value configs.
 * Handles: scalars, simple lists (- item), and one level of nesting.
 * No external dependency needed for our simple config format.
 */
function parseSimpleYaml(text) {
  const result = {};
  let currentKey = null;
  let currentList = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');

    if (!line.trim() || line.trim().startsWith('#')) continue;

    // List item under a key
    const listMatch = line.match(/^(\s+)-\s+(.+)$/);
    if (listMatch && currentKey) {
      if (!currentList) {
        currentList = [];
        result[currentKey] = currentList;
      }
      currentList.push(listMatch[2].trim());
      continue;
    }

    // Nested key: value
    const nestedMatch = line.match(/^(\s+)(\w+):\s*(.+)$/);
    if (nestedMatch && currentKey && !Array.isArray(result[currentKey])) {
      if (typeof result[currentKey] !== 'object') {
        result[currentKey] = {};
      }
      result[currentKey][nestedMatch[2]] = nestedMatch[3].trim();
      currentList = null;
      continue;
    }

    // Top-level key
    const keyMatch = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      currentList = null;
      const value = keyMatch[2].trim();
      if (value) {
        result[currentKey] = value;
      }
      // If no value, wait for nested content or list
      continue;
    }
  }

  return result;
}

function findConfigFile() {
  const candidates = [
    join(process.cwd(), '.cli-switch.yaml'),
    join(process.cwd(), '.cli-switch.yml'),
    join(homedir(), '.cli-switch.yaml'),
    join(homedir(), '.cli-switch.yml'),
  ];
  return candidates.find(existsSync) || null;
}

export function loadConfig(overrides = {}) {
  let fileConfig = {};

  const configPath = findConfigFile();
  if (configPath) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      fileConfig = parseSimpleYaml(raw);
    } catch (err) {
      console.warn(`Warning: Could not parse config at ${configPath}: ${err.message}`);
    }
  }

  // Merge: defaults < file config < CLI overrides
  const config = { ...DEFAULTS };

  if (fileConfig.tools && Array.isArray(fileConfig.tools)) {
    config.tools = fileConfig.tools;
  }
  if (fileConfig.layout) config.layout = fileConfig.layout;
  if (fileConfig.session_name) config.session_name = fileConfig.session_name;
  if (fileConfig.keybindings) {
    config.keybindings = { ...DEFAULTS.keybindings, ...fileConfig.keybindings };
  }

  // CLI overrides take priority
  if (overrides.tools?.length) config.tools = overrides.tools;
  if (overrides.layout) config.layout = overrides.layout;
  if (overrides.sessionName) config.session_name = overrides.sessionName;

  return config;
}
