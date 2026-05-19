const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const initScript = path.resolve(__dirname, '..', 'init.js');

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-mode-init-'));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude', 'settings.json'),
    JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash|Edit|Write|MultiEdit|Agent|Task',
              hooks: [
                {
                  type: 'command',
                  command: '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/gsd-context-monitor.js',
                  timeout: 10,
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ) + '\n',
  );
  return root;
}

function runInit(root) {
  execFileSync(process.execPath, [initScript, '--root', root], {
    cwd: root,
    stdio: 'pipe',
  });
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function settingsCommands(settings, eventName) {
  return (settings.hooks[eventName] || []).flatMap((entry) =>
    (entry.hooks || []).map((hook) => hook.command),
  );
}

test('scaffold creates advisor-mode assets and preserves settings idempotently', () => {
  const root = makeTempRepo();

  runInit(root);
  runInit(root);

  const expectedFiles = [
    '.claude/agents/advisor-reviewer.md',
    '.claude/agents/executor-guidance.md',
    '.claude/hooks/advisor-boundary-check.js',
    '.claude/hooks/advisor-install-audit.js',
    '.claude/advisor-mode/policy.example.json',
    '.claude/advisor-mode/verdict.schema.json',
    '.advisor/audit/.gitkeep',
    '.advisor/state/.gitkeep',
  ];

  for (const file of expectedFiles) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }

  const advisorAgent = read(root, '.claude/agents/advisor-reviewer.md');
  assert.match(advisorAgent, /^model: opus$/m);
  assert.match(advisorAgent, /^tools: Read, Grep, Glob$/m);
  assert.doesNotMatch(advisorAgent, /\b(Bash|Write|Edit|MultiEdit)\b/);

  const settings = JSON.parse(read(root, '.claude/settings.json'));
  const postToolCommands = settingsCommands(settings, 'PostToolUse');
  const preToolCommands = settingsCommands(settings, 'PreToolUse');

  assert.equal(
    postToolCommands.filter((command) => command.includes('gsd-context-monitor.js')).length,
    1,
    'existing gsd PostToolUse hook should be preserved once',
  );
  assert.equal(
    preToolCommands.filter((command) => command.includes('advisor-boundary-check.js')).length,
    1,
    'advisor boundary hook should be added once',
  );
  assert.equal(
    postToolCommands.filter((command) => command.includes('advisor-install-audit.js')).length,
    1,
    'advisor install audit hook should be added once',
  );

  assert.equal(fs.existsSync(path.join(root, '.planning', 'advisor-audit.jsonl')), false);
  assert.equal(fs.existsSync(path.join(root, '.planning', 'advisor-state.json')), false);

  const gitignore = read(root, '.gitignore');
  assert.match(gitignore, /^\.advisor\/audit\/\*\.jsonl$/m);
  assert.match(gitignore, /^!\.advisor\/audit\/\.gitkeep$/m);
  assert.match(gitignore, /^\.advisor\/state\/\*\.json$/m);
  assert.match(gitignore, /^!\.advisor\/state\/\.gitkeep$/m);
});
