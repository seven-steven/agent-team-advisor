const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runtimePath } = require('../runtime-paths.js');

const {
  appendAuditEvent,
  readAuditEvents,
  filterAuditEvents,
  buildCorrelationFields,
  sanitizeAuditEvent,
} = require('../audit-log.js');

function tempRuntime() {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-audit-log-'));
  const root = path.join(runtimeRoot, 'project');
  fs.mkdirSync(root, { recursive: true });
  return { root, runtimeRoot, auditPath: runtimePath(root, ['audit', 'events.jsonl'], { runtimeRoot }) };
}

test('appendAuditEvent appends compact JSON lines without rewriting prior events', () => {
  const ctx = tempRuntime();

  appendAuditEvent({ event: 'advisor.triggered', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1' }, ctx);
  const firstRaw = fs.readFileSync(ctx.auditPath, 'utf8');
  const firstLines = firstRaw.trim().split('\n');
  assert.equal(firstLines.length, 1);
  assert.equal(JSON.parse(firstLines[0]).event, 'advisor.triggered');

  appendAuditEvent({ event: 'provider_route.executor_call', correlationKey: 'corr-2', taskId: 'task-2', sessionId: 'sess-2' }, ctx);
  const secondLines = fs.readFileSync(ctx.auditPath, 'utf8').trim().split('\n');
  assert.equal(secondLines.length, 2);
  assert.equal(secondLines[0], firstLines[0]);
  assert.deepEqual(secondLines.map((line) => JSON.parse(line).event), ['advisor.triggered', 'provider_route.executor_call']);
});

test('buildCorrelationFields preserves dual keys and degrades deterministically', () => {
  assert.deepEqual(
    buildCorrelationFields({ correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1' }),
    { correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1' },
  );
  assert.deepEqual(
    buildCorrelationFields({ task_id: 'task-1' }),
    { correlationKey: 'task-1', taskId: 'task-1' },
  );
  assert.deepEqual(
    buildCorrelationFields({ session_id: 'sess-1' }),
    { correlationKey: 'sess-1', sessionId: 'sess-1' },
  );
  assert.deepEqual(
    buildCorrelationFields({ correlationKey: 'corr-only' }),
    { correlationKey: 'corr-only' },
  );
  const fallbackA = buildCorrelationFields({ event: 'advisor.triggered', toolName: 'Bash' });
  const fallbackB = buildCorrelationFields({ toolName: 'Bash', event: 'advisor.triggered' });
  assert.match(fallbackA.correlationKey, /^audit-[a-f0-9]{24}$/);
  assert.equal(fallbackA.correlationKey, fallbackB.correlationKey);
});

test('readAuditEvents and filterAuditEvents provide raw task and session views', () => {
  const ctx = tempRuntime();
  appendAuditEvent({ event: 'advisor_verdict.recorded', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1' }, ctx);
  appendAuditEvent({ event: 'executor_decision.recorded', correlationKey: 'corr-2', taskId: 'task-2', sessionId: 'sess-1' }, ctx);
  appendAuditEvent({ event: 'final_review_gate.evaluated', correlationKey: 'corr-3', taskId: 'task-1', sessionId: 'sess-2' }, ctx);

  const { events, parseErrors } = readAuditEvents(ctx);
  assert.equal(parseErrors.length, 0);
  assert.equal(events.length, 3);
  assert.deepEqual(filterAuditEvents(events, { taskId: 'task-1' }).map((event) => event.event), [
    'advisor_verdict.recorded',
    'final_review_gate.evaluated',
  ]);
  assert.deepEqual(filterAuditEvents(events, { sessionId: 'sess-1' }).map((event) => event.event), [
    'advisor_verdict.recorded',
    'executor_decision.recorded',
  ]);
});

test('sanitizeAuditEvent removes secret-bearing fields and token-like values', () => {
  const sanitized = sanitizeAuditEvent({
    event: 'advisor.triggered',
    authorization: 'Bearer TOKEN_PLACEHOLDER',
    headers: { authorization: 'Bearer secret' },
    requestBody: { prompt: 'private prompt' },
    prompt: 'private prompt',
    messages: [{ content: 'private' }],
    response: { body: 'raw response body' },
    nested: { token: 'sk-test-secret', safe: 'kept' },
    note: 'Bearer TOKEN_PLACEHOLDER and sk-test-secret',
  });
  const output = JSON.stringify(sanitized);
  assert.doesNotMatch(output, /authorization|headers|requestBody|prompt|messages|raw response body/i);
  assert.doesNotMatch(output, /Bearer|TOKEN_PLACEHOLDER|sk-test-secret/);
  assert.match(output, /kept/);
});

test('producer-shaped fixtures are inspectable with correlation fields', () => {
  const ctx = tempRuntime();
  const fixtures = [
    { event: 'provider_route.executor_call', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1', configuredProvider: 'openrouter', configuredModel: 'executor', observedModel: null },
    { event: 'advisor_verdict.recorded', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1', status: 'CONCERNS' },
    { event: 'executor_decision.recorded', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1', decisionCount: 1 },
    { event: 'advisor.triggered', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1', triggerReason: 'high-risk' },
    { event: 'hook_decision.recorded', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1', gateAction: 'block' },
    { event: 'final_review_gate.evaluated', correlationKey: 'corr-1', taskId: 'task-1', sessionId: 'sess-1', gateAction: 'allow' },
  ];

  fixtures.forEach((fixture) => appendAuditEvent(fixture, ctx));
  const { events } = readAuditEvents(ctx);
  assert.deepEqual(events.map((event) => event.event), fixtures.map((fixture) => fixture.event));
  events.forEach((event) => {
    assert.equal(event.correlationKey, 'corr-1');
    assert.equal(event.taskId, 'task-1');
    assert.equal(event.sessionId, 'sess-1');
  });
});
