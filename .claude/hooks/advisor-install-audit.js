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
    if (input) {
      JSON.parse(input);
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
