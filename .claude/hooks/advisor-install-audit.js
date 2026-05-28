#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function isAdvisorModeEnabled(rootDir) {
  try {
    const configPath = path.join(rootDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.hooks?.advisor_mode === true;
  } catch {
    return false;
  }
}

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = input ? JSON.parse(input) : {};
    const rootDir = data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (!isAdvisorModeEnabled(rootDir)) {
      process.exit(0);
    }
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: 'Advisor Mode install audit hook active; Phase 1 records no runtime events by default.',
      },
    };
    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exit(0);
  }
});
