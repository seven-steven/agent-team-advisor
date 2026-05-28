const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const advisorModeRoot = path.resolve(__dirname, '..');
const finalReviewPath = path.join(advisorModeRoot, 'final-review.js');
const dispositionSchemaPath = path.join(advisorModeRoot, 'disposition.schema.json');
const { runtimePath } = require('../runtime-paths.js');
const {
  recordExecutorDecision,
  validateExecutorDecision,
  normalizeRecommendedActions,
} = require(finalReviewPath);

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-executor-decision-'));
}

function makeVerdict(overrides = {}) {
  return {
    status: 'CONCERNS',
    risk: 'medium',
    confidence: 'high',
    blocking_findings: [],
    recommended_actions: [
      { id: 'rec-keep-tests', description: 'Keep test output linked as evidence.' },
      'Run final smoke verification.',
      { id: 'rec-doc-risk', description: 'Document residual risk.' },
    ],
    verification_guidance: ['node --test .claude/advisor-mode/tests/disposition.test.js'],
    validation_checklist: ['Each recommendation has executor follow-up.'],
    correlationKey: 'final-review-03-03',
    context_packet_ref: '.advisor/state/context-packets/final-review-03-03.json',
    created_at: '2026-05-27T07:00:00.000Z',
    ...overrides,
  };
}

function makeDecisions(overrides = []) {
  const base = [
    {
      recommendation_id: 'rec-keep-tests',
      disposition: 'accepted',
      rationale: 'The referenced test command is decisive for this slice.',
      evidence_refs: ['.advisor/evidence/verification/final-review-03-03.json#commands.0'],
    },
    {
      recommendation_id: 'rec-002',
      disposition: 'rejected',
      rationale: 'A separate smoke test would duplicate the node:test coverage here.',
      evidence_refs: ['.advisor/evidence/verification/final-review-03-03.json#summary'],
    },
    {
      recommendation_id: 'rec-doc-risk',
      disposition: 'deferred',
      rationale: 'Residual-risk reporting belongs with the later verification-evidence slice.',
      evidence_refs: ['.planning/phases/03-verdict-handoff-and-verification-evidence/03-CONTEXT.md#D-13'],
    },
  ];
  return base.map((decision, index) => ({ ...decision, ...(overrides[index] || {}) }));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('disposition schema is a strict executor-decision artifact contract', () => {
  const schema = readJson(dispositionSchemaPath);

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  for (const field of [
    'artifact_type',
    'correlationKey',
    'verdict_ref',
    'executor_decisions',
    'created_at',
  ]) {
    assert.ok(schema.properties[field], `schema should define ${field}`);
    assert.ok(schema.required.includes(field), `schema should require ${field}`);
  }
  assert.deepEqual(
    schema.properties.executor_decisions.items.properties.disposition.enum,
    ['accepted', 'rejected', 'deferred'],
  );
});

test('recordExecutorDecision writes separate executor artifact without mutating verdict file', () => {
  const root = makeTempRepo();
  const verdict = makeVerdict();
  const verdictPath = runtimePath(root, ['verdicts', `${verdict.correlationKey}.json`]);
  fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
  fs.writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`);
  const originalVerdictBytes = fs.readFileSync(verdictPath, 'utf8');
  const originalVerdictObject = JSON.stringify(verdict);

  const result = recordExecutorDecision(
    {
      correlationKey: verdict.correlationKey,
      verdict,
      verdict_ref: runtimePath(root, ['verdicts', `${verdict.correlationKey}.json`]),
      decisions: makeDecisions(),
    },
    { root },
  );

  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(verdictPath, 'utf8'), originalVerdictBytes);
  assert.equal(JSON.stringify(verdict), originalVerdictObject);
  assert.equal(fs.existsSync(runtimePath(root, ['decisions', 'executor', `${verdict.correlationKey}.json`])), true);
  assert.equal(fs.existsSync(runtimePath(root, ['decisions', 'dispositions', `${verdict.correlationKey}.json`])), false);

  const artifact = readJson(result.path);
  assert.equal(artifact.artifact_type, 'executor-decision');
  assert.equal(artifact.correlationKey, verdict.correlationKey);
  assert.equal(artifact.verdict_ref, runtimePath(root, ['verdicts', `${verdict.correlationKey}.json`]));
  assert.deepEqual(
    artifact.executor_decisions.map((decision) => decision.disposition),
    ['accepted', 'rejected', 'deferred'],
  );
  assert.equal(artifact.executor_decisions.every((decision) => typeof decision.decided_at === 'string' && decision.decided_at.length > 0), true);
});

test('validateExecutorDecision requires one valid decision per normalized recommendation', () => {
  const verdict = makeVerdict();
  const validArtifact = {
    artifact_type: 'executor-decision',
    correlationKey: verdict.correlationKey,
    verdict_ref: '.advisor/verdicts/final-review-03-03.json',
    executor_decisions: makeDecisions().map((decision) => ({
      ...decision,
      decided_at: '2026-05-27T07:01:00.000Z',
    })),
    created_at: '2026-05-27T07:01:00.000Z',
  };

  assert.equal(validateExecutorDecision(validArtifact, verdict).ok, true);

  const missingDecision = {
    ...validArtifact,
    executor_decisions: validArtifact.executor_decisions.slice(0, 2),
  };
  const missing = validateExecutorDecision(missingDecision, verdict);
  assert.equal(missing.ok, false);
  assert.equal(missing.errors.some((error) => error.includes('rec-doc-risk')), true);

  const invalidDisposition = {
    ...validArtifact,
    executor_decisions: validArtifact.executor_decisions.map((decision, index) =>
      index === 0 ? { ...decision, disposition: 'approve' } : decision,
    ),
  };
  const invalid = validateExecutorDecision(invalidDisposition, verdict);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.some((error) => error.includes('disposition')), true);
});

test('validateExecutorDecision rejects duplicate recommendation decisions', () => {
  const verdict = makeVerdict();
  const artifact = {
    artifact_type: 'executor-decision',
    correlationKey: verdict.correlationKey,
    verdict_ref: '.advisor/verdicts/final-review-03-03.json',
    executor_decisions: [
      ...makeDecisions().map((decision) => ({
        ...decision,
        decided_at: '2026-05-27T07:01:00.000Z',
      })),
      {
        recommendation_id: 'rec-keep-tests',
        disposition: 'rejected',
        rationale: 'Contradictory duplicate should not validate.',
        evidence_refs: ['.advisor/evidence/verification/final-review-03-03.json#commands.0'],
        decided_at: '2026-05-27T07:02:00.000Z',
      },
    ],
    created_at: '2026-05-27T07:01:00.000Z',
  };

  const result = validateExecutorDecision(artifact, verdict);

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes('duplicate') && error.includes('rec-keep-tests')), true);
});

test('recordExecutorDecision appends concise audit event after validation', () => {
  const root = makeTempRepo();
  const verdict = makeVerdict();

  const result = recordExecutorDecision(
    {
      correlationKey: verdict.correlationKey,
      verdict,
      verdict_ref: runtimePath(root, ['verdicts', `${verdict.correlationKey}.json`]),
      decisions: makeDecisions(),
    },
    { root },
  );

  assert.equal(result.ok, true);
  const events = fs
    .readFileSync(runtimePath(root, ['audit', 'events.jsonl']), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'executor.final_review_decision.recorded');
  assert.equal(events[0].correlationKey, verdict.correlationKey);
  assert.equal(events[0].artifactPath, result.path);
  assert.equal(events[0].decisionCount, normalizeRecommendedActions(verdict.recommended_actions).length);
});
