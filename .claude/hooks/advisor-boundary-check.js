#!/usr/bin/env node
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
    const toolName = data.tool_name || data.toolName || '';
    if (!toolName) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext:
          'Advisor Mode boundary check: advisor remains read-only; executor retains mutation and command authority.',
      },
    };
    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exit(0);
  }
});
