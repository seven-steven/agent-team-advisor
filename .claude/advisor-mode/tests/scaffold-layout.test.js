const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const initScript = path.resolve(__dirname, '..', 'init.js');

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-mode-layout-'));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
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

function assertExists(root, relativePath) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} should exist`);
}

test('scaffold documents repo-scoped versioned layout and runtime separation', () => {
  const root = makeTempRepo();

  runInit(root);

  const versionedAssets = [
    '.claude/agents/advisor-reviewer.md',
    '.claude/agents/executor-guidance.md',
    '.claude/hooks/advisor-boundary-check.js',
    '.claude/hooks/advisor-install-audit.js',
    '.claude/settings.json',
    '.claude/advisor-mode/README.md',
    '.claude/advisor-mode/policy.example.json',
    '.claude/advisor-mode/verdict.schema.json',
  ];

  for (const asset of versionedAssets) {
    assert.match(asset, /^\.claude\//, `${asset} should be a versioned .claude asset`);
    assertExists(root, asset);
  }

  assertExists(root, '.advisor/audit/.gitkeep');
  assertExists(root, '.advisor/state/.gitkeep');
  assert.equal(fs.existsSync(path.join(root, '.planning', 'advisor-audit.jsonl')), false);
  assert.equal(fs.existsSync(path.join(root, '.planning', 'advisor-state.json')), false);

  const readme = read(root, '.claude/advisor-mode/README.md');
  assert.match(readme, /node \.claude\/advisor-mode\/init\.js/);
  assert.match(readme, /node --test \.claude\/advisor-mode\/tests\/\*\.test\.js/);

  for (const expected of [
    '.claude/agents/advisor-reviewer.md',
    '.claude/agents/executor-guidance.md',
    '.claude/hooks/advisor-boundary-check.js',
    '.claude/hooks/advisor-install-audit.js',
    '.claude/settings.json',
    '.claude/advisor-mode/policy.example.json',
    '.claude/advisor-mode/verdict.schema.json',
    '.advisor/audit',
    '.advisor/state',
  ]) {
    assert.match(readme, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const policy = JSON.parse(read(root, '.claude/advisor-mode/policy.example.json'));
  assert.equal(policy.advisorMode.runtime.auditTarget, '.advisor/audit/events.jsonl');
  assert.deepEqual(policy.advisorMode.auditEvents.baseline, [
    'scaffold.install',
    'advisor.verdict.received',
    'executor.followup.recorded',
  ]);
});
