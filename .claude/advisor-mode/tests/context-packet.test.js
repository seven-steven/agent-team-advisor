const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const claudeRoot = path.resolve(__dirname, '..', '..');
const finalReviewPath = path.join(claudeRoot, 'advisor-mode', 'final-review.js');
const schemaPath = path.join(claudeRoot, 'advisor-mode', 'context-packet.schema.json');
const { buildContextPacket, validateContextPacket } = require(finalReviewPath);

function sampleInput(overrides = {}) {
  return {
    correlationKey: 'phase-03-plan-01',
    task_summary: 'Create minimized advisor context packet',
    changed_files: ['.claude/advisor-mode/final-review.js'],
    relevant_diff_excerpts: [
      {
        file: '.claude/advisor-mode/final-review.js',
        excerpt: '+ buildContextPacket(input)',
      },
    ],
    relevant_errors: ['node --test failed before implementation'],
    explicit_questions: ['Does this packet include enough final-review context?'],
    verification_summary: {
      command: 'node --test .claude/advisor-mode/tests/context-packet.test.js',
      exit_status: 0,
      summary: 'context packet tests pass',
    },
    transcript: 'must not be forwarded',
    full_transcript: 'must not be forwarded',
    raw_log: 'must not be forwarded',
    arbitrary_extra: 'must not be forwarded',
    ...overrides,
  };
}

test('context packet schema is strict and requires the minimized four-part bundle', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    schema.required.filter((key) =>
      ['changed_files', 'relevant_diff_excerpts', 'relevant_errors', 'explicit_questions'].includes(key),
    ),
    ['changed_files', 'relevant_diff_excerpts', 'relevant_errors', 'explicit_questions'],
  );
  assert.equal(Object.hasOwn(schema.properties, 'transcript'), false);
  assert.equal(Object.hasOwn(schema.properties, 'full_transcript'), false);
  assert.equal(Object.hasOwn(schema.properties, 'raw_log'), false);
});

test('buildContextPacket returns only whitelisted minimized context fields by default', () => {
  const packet = buildContextPacket(sampleInput());

  assert.equal(packet.packet_type, 'advisor-final-review-context');
  assert.deepEqual(packet.changed_files, ['.claude/advisor-mode/final-review.js']);
  assert.deepEqual(packet.relevant_diff_excerpts, [
    {
      file: '.claude/advisor-mode/final-review.js',
      excerpt: '+ buildContextPacket(input)',
    },
  ]);
  assert.deepEqual(packet.relevant_errors, ['node --test failed before implementation']);
  assert.deepEqual(packet.explicit_questions, ['Does this packet include enough final-review context?']);
  assert.equal(packet.verification_summary.command, 'node --test .claude/advisor-mode/tests/context-packet.test.js');
  assert.match(packet.created_at, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(Object.hasOwn(packet, 'transcript'), false);
  assert.equal(Object.hasOwn(packet, 'full_transcript'), false);
  assert.equal(Object.hasOwn(packet, 'raw_log'), false);
  assert.equal(Object.hasOwn(packet, 'arbitrary_extra'), false);
});

test('validateContextPacket accepts valid minimized packets', () => {
  const packet = buildContextPacket(sampleInput());

  const result = validateContextPacket(packet);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateContextPacket rejects missing explicit questions', () => {
  const packet = buildContextPacket(sampleInput({ explicit_questions: [] }));

  const result = validateContextPacket(packet);

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes('explicit_questions')), true);
});

test('validateContextPacket rejects transcript and raw-log fields', () => {
  const packet = buildContextPacket(sampleInput());
  packet.transcript = 'full conversation';
  packet.raw_log = 'raw terminal log';

  const result = validateContextPacket(packet);

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes('transcript')), true);
  assert.equal(result.errors.some((error) => error.includes('raw_log')), true);
});
