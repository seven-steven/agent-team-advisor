#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BOUNDARY_COMMAND = '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-boundary-check.js';
const AUDIT_COMMAND = '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-install-audit.js';
const GITIGNORE_RULES = [
  '.advisor/audit/*.jsonl',
  '!.advisor/audit/.gitkeep',
  '.advisor/state/*.json',
  '!.advisor/state/.gitkeep',
];
const RUNTIME_PLACEHOLDERS = ['.advisor/audit/.gitkeep', '.advisor/state/.gitkeep'];

const files = {
  '.claude/agents/advisor-reviewer.md': `---
name: advisor-reviewer
description: Read-only Advisor Mode reviewer for risk, findings, actions, and verification guidance.
model: opus
tools: Read, Grep, Glob
color: "#7C3AED"
---

<role>
You are the Advisor Mode reviewer. Inspect repository context and return a verdict-first review for the executor.
</role>

<boundaries>
You are read-only. The executor retains all workspace mutation, command execution, commit, and final decision authority.
</boundaries>

<output>
Return a verdict-first response with:
1. status: PASS, CONCERNS, FAIL, or BLOCKED
2. risk level and confidence
3. blocking findings
4. recommended executor actions
5. verification guidance
</output>
`,
  '.claude/agents/executor-guidance.md': `---
name: executor-guidance
description: Advisor Mode executor guidance preserving executor-only mutation authority.
model: sonnet
color: "#2563EB"
---

# Executor Guidance

The executor owns implementation, workspace mutation, tool execution, verification, commits, and final decisions. Executor-only mutation tools include Bash, Write, Edit, and MultiEdit.

Advisor Mode consultations are advisory and read-only. Treat advisor verdicts as structured risk input, then decide and execute the minimum safe change needed for the current task.

Use the advisor for high-risk changes, uncertainty, repeated failures, and final readiness checks as later policy phases enable those gates.
`,
  '.claude/hooks/advisor-boundary-check.js': `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_MODEL = 'opus';
const REQUIRED_TOOLS = ['Read', 'Grep', 'Glob'];
const MUTATING_TOOLS = ['Bash', 'Write', 'Edit', 'MultiEdit'];

function parseFrontmatter(source) {
  const match = source.match(/^---\\n([\\s\\S]*?)\\n---\\n/);
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split('\\n')
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
    findings.push(\`advisor-reviewer.md unreadable: \${error.message}\`);
  }

  const modelFinding = frontmatter.model
    ? \`advisor model must be \${REQUIRED_MODEL}, found \${frontmatter.model}\`
    : 'advisor model is omitted';
  if (frontmatter.model !== REQUIRED_MODEL) {
    findings.push(modelFinding);
  }

  const advisorTools = parseTools(frontmatter.tools);
  for (const tool of REQUIRED_TOOLS) {
    if (!advisorTools.includes(tool)) {
      findings.push(\`advisor tools missing \${tool}\`);
    }
  }
  for (const tool of MUTATING_TOOLS) {
    if (advisorTools.includes(tool)) {
      findings.push(\`advisor tools include mutating tool \${tool}\`);
    }
  }
  if (!hasRequiredToolSet(advisorTools)) {
    findings.push(\`advisor tools must be exactly \${REQUIRED_TOOLS.join(', ')}\`);
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
`,
  '.claude/hooks/advisor-install-audit.js': `#!/usr/bin/env node
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
`,
  '.claude/advisor-mode/README.md': `# Advisor Mode Scaffold

Advisor Mode is installed as repo-scoped Claude Code assets. Run this from the repository root:

\`\`\`bash
node .claude/advisor-mode/init.js
\`\`\`

Validate Phase 1 local install correctness with:

\`\`\`bash
node --test .claude/advisor-mode/tests/*.test.js
\`\`\`

## Created Files

- \`.claude/agents/advisor-reviewer.md\` — read-only advisor role definition.
- \`.claude/agents/executor-guidance.md\` — executor authority guidance.
- \`.claude/hooks/advisor-boundary-check.js\` — boundary reminder hook.
- \`.claude/hooks/advisor-install-audit.js\` — scaffold audit reminder hook.
- \`.claude/settings.json\` — project-local hook wiring.
- \`.claude/advisor-mode/policy.example.json\` — versioned policy example.
- \`.claude/advisor-mode/verdict.schema.json\` — versioned advisor verdict schema.
- \`.advisor/audit\` — local runtime audit directory for JSONL events.
- \`.advisor/state\` — local runtime state directory.

## Phase 1 Boundary

Phase 1 validates local scaffold installation only. Provider routing conformance, high-risk trigger enforcement, budgets, and full telemetry are later phases.
`,
  '.claude/advisor-mode/policy.example.json': JSON.stringify(
    {
      schemaVersion: 1,
      advisorMode: {
        enabled: true,
        advisorAgent: 'advisor-reviewer',
        executorAuthority: 'executor-only',
        runtime: {
          auditPattern: '.advisor/audit/*.jsonl',
          auditTarget: '.advisor/audit/events.jsonl',
          statePattern: '.advisor/state/*.json',
        },
        auditEvents: {
          baseline: ['scaffold.install', 'advisor.verdict.received', 'executor.followup.recorded'],
        },
        phase1: {
          installsExternalPackages: false,
          hooksFailOpen: true,
        },
      },
    },
    null,
    2,
  ) + '\n',
  '.claude/advisor-mode/verdict.schema.json': JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Advisor Mode Verdict',
      type: 'object',
      additionalProperties: false,
      required: ['status', 'risk', 'confidence', 'blocking_findings', 'recommended_actions', 'verification_guidance'],
      properties: {
        status: {
          type: 'string',
          enum: ['PASS', 'CONCERNS', 'FAIL', 'BLOCKED'],
        },
        risk: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        blocking_findings: {
          type: 'array',
          items: { type: 'string' },
        },
        recommended_actions: {
          type: 'array',
          items: { type: 'string' },
        },
        verification_guidance: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    null,
    2,
  ) + '\n',
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(rootDir, relativePath, content) {
  const target = path.join(rootDir, relativePath);
  ensureDir(target);
  fs.writeFileSync(target, content);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hookCommandExists(entries, command) {
  return entries.some((entry) => (entry.hooks || []).some((hook) => hook.command === command));
}

function advisorHook(command, timeout = 5) {
  return [{ type: 'command', command, timeout }];
}

function addHook(settings, eventName, hookEntry, command) {
  settings.hooks ||= {};
  settings.hooks[eventName] ||= [];
  if (!hookCommandExists(settings.hooks[eventName], command)) {
    settings.hooks[eventName].push(hookEntry);
  }
}

function mergeSettings(rootDir) {
  const settingsPath = path.join(rootDir, '.claude', 'settings.json');
  ensureDir(settingsPath);
  const settings = readJson(settingsPath, {});

  addHook(
    settings,
    'PreToolUse',
    {
      matcher: 'Bash|Edit|Write|MultiEdit',
      hooks: advisorHook(BOUNDARY_COMMAND),
    },
    BOUNDARY_COMMAND,
  );
  addHook(
    settings,
    'PostToolUse',
    {
      matcher: 'Bash|Edit|Write|MultiEdit|Agent|Task',
      hooks: advisorHook(AUDIT_COMMAND),
    },
    AUDIT_COMMAND,
  );

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

function mergeGitignore(rootDir) {
  const gitignorePath = path.join(rootDir, '.gitignore');
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const lines = new Set(existing.split(/\r?\n/).filter(Boolean));
  const additions = GITIGNORE_RULES.filter((rule) => !lines.has(rule));
  if (additions.length === 0) {
    return;
  }
  const prefix = existing && !existing.endsWith('\n') ? existing + '\n' : existing;
  fs.writeFileSync(gitignorePath, prefix + additions.join('\n') + '\n');
}

function scaffoldAdvisorMode(rootDir = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(resolvedRoot, relativePath, content);
  }
  for (const relativePath of RUNTIME_PLACEHOLDERS) {
    writeFile(resolvedRoot, relativePath, '');
  }
  mergeSettings(resolvedRoot);
  mergeGitignore(resolvedRoot);
  return { rootDir: resolvedRoot, files: [...Object.keys(files), ...RUNTIME_PLACEHOLDERS] };
}

function main(argv = process.argv.slice(2)) {
  let rootDir = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      if (!argv[index + 1]) {
        throw new Error('--root requires a path');
      }
      rootDir = argv[index + 1];
      index += 1;
    }
  }
  scaffoldAdvisorMode(rootDir);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, scaffoldAdvisorMode };
