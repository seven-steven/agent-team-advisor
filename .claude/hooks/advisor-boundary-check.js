#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_MODEL = 'opus';
const REQUIRED_TOOLS = ['Read', 'Grep', 'Glob'];
const MUTATING_TOOLS = ['Bash', 'Write', 'Edit', 'MultiEdit'];

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':');
        if (separator === -1) {
          return [line.trim(), ''];
        }
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

function parseTools(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((tool) => tool.trim())
    .filter(Boolean);
}

function hasRequiredToolSet(tools) {
  return tools.length === REQUIRED_TOOLS.length && REQUIRED_TOOLS.every((tool) => tools.includes(tool));
}

function validateAdvisorBoundary(rootDir) {
  const findings = [];
  let frontmatter = {};

  try {
    const advisorPath = path.join(rootDir, '.claude', 'agents', 'advisor-reviewer.md');
    frontmatter = parseFrontmatter(fs.readFileSync(advisorPath, 'utf8'));
  } catch (error) {
    findings.push(`advisor-reviewer.md unreadable: ${error.message}`);
  }

  const modelFinding = frontmatter.model
    ? `advisor model must be ${REQUIRED_MODEL}, found ${frontmatter.model}`
    : 'advisor model is omitted';
  if (frontmatter.model !== REQUIRED_MODEL) {
    findings.push(modelFinding);
  }

  const advisorTools = parseTools(frontmatter.tools);
  for (const tool of REQUIRED_TOOLS) {
    if (!advisorTools.includes(tool)) {
      findings.push(`advisor tools missing ${tool}`);
    }
  }
  for (const tool of MUTATING_TOOLS) {
    if (advisorTools.includes(tool)) {
      findings.push(`advisor tools include mutating tool ${tool}`);
    }
  }
  if (!hasRequiredToolSet(advisorTools)) {
    findings.push(`advisor tools must be exactly ${REQUIRED_TOOLS.join(', ')}`);
  }

  return {
    ok: findings.length === 0,
    findings,
    advisorTools,
  };
}

function writeHookContext() {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        'Advisor Mode boundary check: advisor remains read-only; executor retains mutation and command authority.',
    },
  };
  process.stdout.write(JSON.stringify(output));
}

function main() {
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

      writeHookContext();
    } catch {
      process.exit(0);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  validateAdvisorBoundary,
  main,
};
