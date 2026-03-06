/**
 * Registry of supported AI CLI tools.
 * Each tool defines its command, display name, and how to detect if it's installed.
 */

import { execSync } from 'node:child_process';

const TOOL_REGISTRY = {
  claude: {
    name: 'Claude',
    command: 'claude',
    description: 'Anthropic Claude Code CLI',
    color: '#D97706',
  },
  gemini: {
    name: 'Gemini',
    command: 'gemini',
    description: 'Google Gemini CLI',
    color: '#4285F4',
  },
  copilot: {
    name: 'Copilot',
    command: 'copilot',
    description: 'GitHub Copilot CLI',
    color: '#6E40C9',
  },
  aichat: {
    name: 'AIChat',
    command: 'aichat',
    description: 'AIChat multi-model CLI',
    color: '#10B981',
  },
};

export function getToolRegistry() {
  return { ...TOOL_REGISTRY };
}

export function getToolNames() {
  return Object.keys(TOOL_REGISTRY);
}

export function getTool(name) {
  const key = name.toLowerCase();
  return TOOL_REGISTRY[key] || null;
}

export function isToolInstalled(name) {
  const tool = getTool(name);
  if (!tool) return false;
  try {
    execSync(`which ${tool.command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getInstalledTools(requestedTools) {
  const results = [];
  for (const name of requestedTools) {
    const tool = getTool(name);
    if (!tool) {
      console.warn(`Unknown tool: ${name}. Skipping.`);
      continue;
    }
    if (!isToolInstalled(name)) {
      console.warn(`${tool.name} (${tool.command}) is not installed. Skipping.`);
      continue;
    }
    results.push({ key: name.toLowerCase(), ...tool });
  }
  return results;
}
