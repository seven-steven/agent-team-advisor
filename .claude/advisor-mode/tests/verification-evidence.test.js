const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runtimePath } = require('../runtime-paths.js');
const finalReview = require('../final-review.js');
const schemaPath = path.resolve(__dirname, '..', 'verification-evidence.schema.json');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-verification-evidence-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validInput(overrides = {}) {
  return {
    correlationKey: 'final-review-123',
    verdict_ref: '.advisor/verdicts/final-review-123.json',
    executor_decision_ref: '.advisor/decisions/executor/final-review-123.json',
    commands: [
      {
        purpose: 'test',
        command: 'node --test .claude/advisor-mode/tests/verification-evidence.test.js',
        exit_status: 0,
        summary: 'verification evidence tests passed',
        timestamp: '2026-05-27T06:55:00.000Z',
      },
      {
        purpose: 'manual-check-summary',
        command: 'manual review of advisor verdict handoff',
        exit_status: 'pass',
        summary: 'manual checklist confirms guarded task evidence is concise',
        timestamp: '2026-05-27T06:56:00.000Z',
      },
    ],
    changed_files: [
      '.claude/advisor-mode/final-review.js',
      '.claude/advisor-mode/verification-evidence.schema.json',
    ],
    residual_risks: ['No external provider conformance validated in this phase.'],
    created_at: '2026-05-27T06:57:00.000Z',
    ...overrides,
  };
}

test('verification evidence schema is strict Draft 2020-12 with command and package fields', () => {
  const schema = readJson(schemaPath);

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    'artifact_type',
    'correlationKey',
    'commands',
    'changed_files',
    'residual_risks',
    'created_at',
  ]);
  assert.equal(schema.properties.artifact_type.const, 'verification-evidence');
  assert.deepEqual(schema.properties.commands.items.required, [
    'purpose',
    'command',
    'exit_status',
    'summary',
    'timestamp',
  ]);
  assert.deepEqual(schema.properties.commands.items.properties.purpose.enum, [
    'test',
    'typecheck',
    'lint',
    'smoke',
    'assertion',
    'manual-check-summary',
  ]);
});

test('recordVerificationEvidence writes one immutable verification snapshot and audit event', () => {
  assert.equal(typeof finalReview.recordVerificationEvidence, 'function');
  assert.equal(typeof finalReview.validateVerificationEvidence, 'function');
  const root = makeTempRepo();

  const result = finalReview.recordVerificationEvidence(validInput(), { root });

  assert.equal(result.ok, true);
  assert.equal(
    result.path,
    runtimePath(root, ['evidence', 'verification', 'final-review-123.json']),
  );
  const artifact = readJson(result.path);
  assert.equal(artifact.artifact_type, 'verification-evidence');
  assert.equal(artifact.correlationKey, 'final-review-123');
  assert.equal(artifact.verdict_ref, '.advisor/verdicts/final-review-123.json');
  assert.equal(artifact.executor_decision_ref, '.advisor/decisions/executor/final-review-123.json');
  assert.deepEqual(artifact.changed_files, [
    '.claude/advisor-mode/final-review.js',
    '.claude/advisor-mode/verification-evidence.schema.json',
  ]);
  assert.deepEqual(artifact.residual_risks, ['No external provider conformance validated in this phase.']);
  assert.equal(artifact.commands.length, 2);
  assert.deepEqual(Object.keys(artifact.commands[0]), [
    'purpose',
    'command',
    'exit_status',
    'summary',
    'timestamp',
  ]);

  const auditLines = fs
    .readFileSync(runtimePath(root, ['audit', 'events.jsonl']), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(auditLines.length, 1);
  assert.equal(auditLines[0].event, 'verification.evidence.recorded');
  assert.equal(auditLines[0].correlationKey, 'final-review-123');
  assert.equal(auditLines[0].artifactPath, result.path);
  assert.equal(auditLines[0].commandCount, 2);
});

test('validateVerificationEvidence rejects development purposes and raw command output fields', () => {
  const invalid = {
    artifact_type: 'verification-evidence',
    ...validInput({
      commands: [
        {
          purpose: 'development',
          command: 'npm install left-pad',
          exit_status: 0,
          summary: 'installed a package',
          timestamp: '2026-05-27T06:58:00.000Z',
          stdout: 'full install output must not be stored',
        },
      ],
    }),
  };

  const validation = finalReview.validateVerificationEvidence(invalid);

  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => error.includes('purpose')), true);
  assert.equal(validation.errors.some((error) => error.includes('unexpected field: stdout')), true);
});

test('recordVerificationEvidence refuses to overwrite an existing correlation snapshot', () => {
  const root = makeTempRepo();
  const first = finalReview.recordVerificationEvidence(validInput(), { root });
  const original = fs.readFileSync(first.path, 'utf8');

  const second = finalReview.recordVerificationEvidence(
    validInput({
      commands: [
        {
          purpose: 'lint',
          command: 'node --check .claude/advisor-mode/final-review.js',
          exit_status: 0,
          summary: 'different evidence that must not overwrite the snapshot',
          timestamp: '2026-05-27T06:59:00.000Z',
        },
      ],
      residual_risks: ['changed after first write'],
    }),
    { root },
  );

  assert.equal(second.ok, false);
  assert.equal(second.errors.some((error) => error.includes('already exists')), true);
  assert.equal(fs.readFileSync(first.path, 'utf8'), original);
});
