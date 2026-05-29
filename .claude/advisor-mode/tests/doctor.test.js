const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const doctorPath = path.resolve(__dirname, '..', 'doctor.js');
const CHECK_IDS = [
  'install.assets',
  'hooks.wiring',
  'advisor.permissions',
  'provider.routes',
  'provider.conformance',
  'runtime.paths',
  'audit.raw_stream',
  'budget.policy',
  'recovery.mode',
];

function mkdirp(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  mkdirp(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(filePath, content) {
  mkdirp(filePath);
  fs.writeFileSync(filePath, content);
}

function makeTempRoot() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-doctor-'));
  return { root: path.join(base, 'project'), runtimeRoot: path.join(base, 'runtime') };
}

function createHealthyProject() {
  const { root, runtimeRoot } = makeTempRoot();
  writeJson(path.join(root, '.claude', 'settings.json'), {
    hooks: {
      PreToolUse: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/advisor-gate.js' }] }],
      PostToolUse: [{ hooks: [
        { type: 'command', command: 'node .claude/hooks/advisor-failure-tracker.js' },
        { type: 'command', command: 'node .claude/hooks/executor-route-audit.js' },
      ] }],
      Stop: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/advisor-final-review-gate.js' }] }],
    },
  });
  writeFile(path.join(root, '.claude', 'agents', 'advisor-reviewer.md'), [
    '---',
    'name: advisor-reviewer',
    'model: opus',
    'tools: Read, Grep, Glob',
    '---',
    '',
    'Read-only reviewer.',
    '',
  ].join('\n'));
  writeJson(path.join(root, '.claude', 'advisor-mode', 'policy.example.json'), {
    schemaVersion: 1,
    advisorMode: {
      enabled: true,
      budget: {
        enabled: true,
        overLimitMode: 'degraded',
        scopes: {
          task: { advisorCalls: 2, advisorTokens: 1000, advisorLatencyMs: 30000 },
          session: { advisorCalls: 5, advisorTokens: 5000, advisorLatencyMs: 120000 },
        },
      },
    },
  });
  writeJson(path.join(root, '.claude', 'advisor-mode', 'provider-routes.example.json'), {
    schemaVersion: 1,
    routes: {
      opus: {
        provider: 'openrouter',
        model: 'openai/gpt-5.5',
        endpointRef: 'openrouter-anthropic',
        credentialEnv: 'ANTHROPIC_AUTH_TOKEN',
        requiredConformance: ['base-message', 'streaming', 'tool-use', 'usage-fields', 'error-shape'],
      },
    },
  });
  writeJson(path.join(root, '.planning', 'config.json'), {
    hooks: {
      advisor_mode: true,
      advisor_mode_strict: true,
      advisor_mode_capabilities: {
        advisorConsultation: true,
        finalReview: true,
        criticalHumanApproval: true,
        protectedSurfaces: true,
      },
    },
  });
  writeJson(path.join(runtimeRoot, 'state', 'provider-conformance.json'), {
    artifact_type: 'provider-conformance',
    event: 'provider_conformance.completed',
    checked_at: '2026-05-29T00:00:00.000Z',
    status: 'pass',
    routes: [{ requestedAlias: 'opus', status: 'pass', checks: [{ name: 'base-message', status: 'pass' }] }],
  });
  return { root, runtimeRoot };
}

function readProtectedFiles(root) {
  const files = [
    '.claude/settings.json',
    '.claude/agents/advisor-reviewer.md',
    '.claude/advisor-mode/policy.example.json',
    '.claude/advisor-mode/provider-routes.example.json',
  ];
  return Object.fromEntries(files.filter((file) => fs.existsSync(path.join(root, file))).map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
}

function assertProtectedFilesUnchanged(root, before) {
  for (const [file, content] of Object.entries(before)) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), content, `${file} mutated`);
  }
}

function assertNoSecretLeak(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  assert.equal(text.includes('TEST_TOKEN_PLACEHOLDER'), false);
  for (const forbidden of ['authorization', 'headers', 'requestBody', 'prompt', 'messages']) {
    assert.equal(text.includes(forbidden), false, `${forbidden} leaked`);
  }
}

test('runDoctor returns complete pass artifact, writes runtime evidence, appends sanitized audit, and does not mutate project assets', async () => {
  const { root, runtimeRoot } = createHealthyProject();
  const before = readProtectedFiles(root);
  const { runDoctor } = require('../doctor.js');

  const artifact = await runDoctor({ root, runtimeRoot, env: { ANTHROPIC_AUTH_TOKEN: 'TEST_TOKEN_PLACEHOLDER' } });

  assert.equal(artifact.artifact_type, 'advisor-mode-doctor');
  assert.equal(artifact.event, 'doctor.completed');
  assert.equal(artifact.status, 'pass');
  assert.deepEqual(artifact.checks.map((check) => check.id), CHECK_IDS);
  for (const check of artifact.checks) {
    assert.equal(check.status, 'pass', `${check.id} should pass`);
    assert.equal(typeof check.summary, 'string');
    assert.ok(check.summary.length > 0);
    assert.equal(typeof check.repair, 'string');
    assert.ok(check.repair.length > 0);
  }
  assertNoSecretLeak(artifact);
  assertProtectedFilesUnchanged(root, before);

  const statePath = path.join(runtimeRoot, 'state', 'doctor.json');
  assert.equal(fs.existsSync(statePath), true);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.event, 'doctor.completed');
  assertNoSecretLeak(state);

  const auditPath = path.join(runtimeRoot, 'audit', 'events.jsonl');
  assert.equal(fs.existsSync(auditPath), true);
  const auditLines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(auditLines.some((event) => event.event === 'doctor.completed'));
  assertNoSecretLeak(auditLines);
});

test('runDoctor reports failed checks with repair guidance instead of mutating files', async () => {
  const { root, runtimeRoot } = createHealthyProject();
  fs.writeFileSync(path.join(root, '.claude', 'settings.json'), JSON.stringify({ hooks: {} }, null, 2));
  const before = readProtectedFiles(root);
  const { runDoctor, runDoctorCheck } = require('../doctor.js');

  const single = await runDoctorCheck('hooks.wiring', { root, runtimeRoot });
  assert.equal(single.id, 'hooks.wiring');
  assert.equal(single.status, 'fail');
  assert.match(single.repair, /advisor-gate\.js/);

  const artifact = await runDoctor({ root, runtimeRoot });
  assert.equal(artifact.status, 'fail');
  const ids = artifact.checks.map((check) => check.id);
  assert.deepEqual(ids, CHECK_IDS);
  assert.ok(artifact.checks.some((check) => check.status === 'fail'));
  for (const check of artifact.checks) assert.ok(check.repair.length > 0);
  assertProtectedFilesUnchanged(root, before);
});

test('CLI --json prints doctor.completed JSON and honors aggregate exit status without leaking secrets', () => {
  const { root, runtimeRoot } = createHealthyProject();
  const result = spawnSync(process.execPath, [doctorPath, '--root', root, '--runtime-root', runtimeRoot, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, ANTHROPIC_AUTH_TOKEN: 'TEST_TOKEN_PLACEHOLDER' },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.event, 'doctor.completed');
  assert.equal(payload.status, 'pass');
  assert.deepEqual(payload.checks.map((check) => check.id), CHECK_IDS);
  assertNoSecretLeak(result.stdout);
  assertNoSecretLeak(result.stderr);
});

test('CLI exits non-zero when doctor status fails', () => {
  const { root, runtimeRoot } = createHealthyProject();
  fs.rmSync(path.join(root, '.claude', 'agents', 'advisor-reviewer.md'));
  const result = spawnSync(process.execPath, [doctorPath, '--root', root, '--runtime-root', runtimeRoot, '--json'], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'fail');
  assert.ok(payload.checks.find((check) => check.id === 'install.assets').repair.length > 0);
});
