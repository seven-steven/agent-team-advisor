const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const advisorModeRoot = path.resolve(__dirname, '..');
const finalReviewPath = path.join(advisorModeRoot, 'final-review.js');
const verdictSchemaPath = path.join(advisorModeRoot, 'verdict.schema.json');
const { validateVerdict, normalizeRecommendedActions } = require(finalReviewPath);

function makeVerdict(overrides = {}) {
  return {
    status: 'PASS',
    risk: 'low',
    confidence: 'high',
    blocking_findings: [],
    recommended_actions: [
      { id: 'rec-existing', description: 'Keep existing verification evidence linked.' },
      'Run the final smoke test.',
    ],
    verification_guidance: ['node --test .claude/advisor-mode/tests/verdict-handoff.test.js'],
    validation_checklist: ['Confirmed changed files match the supplied context packet.'],
    correlationKey: 'final-review-03-02',
    context_packet_ref: '.advisor/state/context-packets/final-review-03-02.json',
    created_at: '2026-05-27T06:30:00.000Z',
    ...overrides,
  };
}

test('verdict schema preserves existing fields and adds final-review fields', () => {
  const schema = JSON.parse(fs.readFileSync(verdictSchemaPath, 'utf8'));
  const properties = schema.properties || {};

  for (const field of [
    'status',
    'risk',
    'confidence',
    'blocking_findings',
    'recommended_actions',
    'verification_guidance',
    'validation_checklist',
    'correlationKey',
    'context_packet_ref',
    'created_at',
  ]) {
    assert.ok(properties[field], `schema should define ${field}`);
    assert.ok(schema.required.includes(field), `schema should require ${field}`);
  }
});

test('normalizeRecommendedActions assigns stable IDs to strings and preserves object IDs', () => {
  const actions = normalizeRecommendedActions([
    'Run tests.',
    { id: 'rec-custom', description: 'Inspect final review.' },
    'Record evidence.',
  ]);

  assert.deepEqual(actions, [
    { id: 'rec-001', description: 'Run tests.' },
    { id: 'rec-custom', description: 'Inspect final review.' },
    { id: 'rec-003', description: 'Record evidence.' },
  ]);
});

test('validateVerdict accepts PASS verdicts and allows direct completion only for PASS', () => {
  const result = validateVerdict(makeVerdict());

  assert.equal(result.ok, true);
  assert.equal(result.direct_completion_allowed, true);
  assert.deepEqual(result.verdict.recommended_actions, [
    { id: 'rec-existing', description: 'Keep existing verification evidence linked.' },
    { id: 'rec-002', description: 'Run the final smoke test.' },
  ]);
});

test('validateVerdict requires executor follow-up for every non-PASS status', () => {
  for (const status of ['CONCERNS', 'FAIL', 'BLOCKED']) {
    const result = validateVerdict(makeVerdict({ status }));

    assert.equal(result.ok, true, `${status} should remain a valid advisor verdict`);
    assert.equal(result.direct_completion_allowed, false, `${status} should not allow direct completion`);
  }
});

test('validateVerdict rejects nested extras and invalid timestamps', () => {
  const invalid = validateVerdict(
    makeVerdict({
      status: 'DONE',
      risk: 'unknown',
      confidence: 'certain',
      validation_checklist: [],
    }),
  );

  assert.equal(invalid.ok, false);
  assert.equal(invalid.direct_completion_allowed, false);
  assert.equal(invalid.errors.some((error) => error.includes('status')), true);
  assert.equal(invalid.errors.some((error) => error.includes('risk')), true);
  assert.equal(invalid.errors.some((error) => error.includes('confidence')), true);
  assert.equal(invalid.errors.some((error) => error.includes('validation_checklist')), true);

  const extraActionField = validateVerdict(
    makeVerdict({
      recommended_actions: [
        {
          id: 'rec-existing',
          description: 'Keep existing verification evidence linked.',
          extra: 'schema drift',
        },
      ],
    }),
  );
  assert.equal(extraActionField.ok, false);
  assert.equal(extraActionField.direct_completion_allowed, false);
  assert.equal(extraActionField.errors.some((error) => error.includes('recommended_actions[0]') && error.includes('extra')), true);

  const invalidTimestamp = validateVerdict(makeVerdict({ created_at: 'not-a-date' }));
  assert.equal(invalidTimestamp.ok, false);
  assert.equal(invalidTimestamp.direct_completion_allowed, false);
  assert.equal(invalidTimestamp.errors.some((error) => error.includes('created_at')), true);

  const validTimestamp = validateVerdict(makeVerdict({ created_at: '2026-05-27T06:30:00.000Z' }));
  assert.equal(validTimestamp.ok, true);
});
