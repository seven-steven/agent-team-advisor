const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runtimePath } = require('../runtime-paths.js');
const { recordExecutorRouteResolution } = require('../../hooks/executor-route-audit.js');
const { writeResolvedRouteArtifact } = require('../provider-routing.js');
const { recordExecutorDecision, recordVerificationEvidence } = require('../final-review.js');
const gate = require('../../hooks/advisor-gate.js');
const { evaluateFinalReviewGate } = require('../../hooks/advisor-final-review-gate.js');

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeAdvisorConfig(root, hooks = { advisor_mode: true, advisor_mode_strict: true }) {
  writeJson(path.join(root, '.planning', 'config.json'), { hooks });
  fs.mkdirSync(path.join(root, '.claude', 'advisor-mode'), { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, '..', 'policy.example.json'), path.join(root, '.claude', 'advisor-mode', 'policy.example.json'));
  fs.copyFileSync(path.resolve(__dirname, '..', 'provider-routes.example.json'), path.join(root, '.claude', 'advisor-mode', 'provider-routes.example.json'));
}

function validVerdict(overrides = {}) {
  return {
    status: 'CONCERNS',
    risk: 'medium',
    confidence: 'high',
    blocking_findings: [],
    recommended_actions: [{ id: 'rec-1', description: 'Review audit output.' }],
    verification_guidance: ['Run audit tests.'],
    validation_checklist: ['Audit tests pass.'],
    correlationKey: 'corr-producer',
    context_packet_ref: '.advisor/context/corr-producer.json',
    created_at: '2026-05-29T00:00:00.000Z',
    ...overrides,
  };
}

function validRecommendation(input, requestPath) {
  return {
    correlationKey: input.correlationKey,
    source: 'read-only-advisor',
    advisorAgent: 'advisor-reviewer',
    status: 'CONCERNS',
    risk: input.risk || 'critical',
    confidence: 'high',
    recommendation: 'Proceed only with explicit audit evidence.',
    rationale: 'Representative recommendation for audit producer tests.',
    blockingFindings: [],
    recommendedActions: ['Record an audited disposition.'],
    verificationGuidance: ['Inspect audit log.'],
    requestPath,
  };
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

test('producer integrations write complete audit surface with dual correlation fields', () => {
  const ctx = tempRuntime();
  writeAdvisorConfig(ctx.root);

  recordExecutorRouteResolution(
    { requestedAlias: 'sonnet', correlationKey: 'corr-producer', taskId: 'task-producer', sessionId: 'sess-producer' },
    ctx,
  );
  writeResolvedRouteArtifact(
    { ok: true, alias: 'sonnet', provider: 'openrouter', model: 'executor-model', endpointRef: 'openrouter-anthropic' },
    { ...ctx, appendAudit: true, correlationKey: 'corr-producer', taskId: 'task-producer', sessionId: 'sess-producer' },
  );
  const verdict = validVerdict({ taskId: 'task-producer', sessionId: 'sess-producer' });
  const decision = recordExecutorDecision(
    {
      verdict,
      correlationKey: 'corr-producer',
      taskId: 'task-producer',
      sessionId: 'sess-producer',
      decisions: [{ recommendation_id: 'rec-1', disposition: 'accepted', rationale: 'Accepted.', evidence_refs: ['audit-log.test.js'] }],
    },
    ctx,
  );
  assert.equal(decision.ok, true);
  const evidence = recordVerificationEvidence(
    {
      correlationKey: 'corr-producer',
      taskId: 'task-producer',
      sessionId: 'sess-producer',
      commands: [{ purpose: 'test', command: 'node --test audit-log.test.js', exit_status: 0, summary: 'passed', timestamp: '2026-05-29T00:01:00.000Z' }],
      changed_files: ['.claude/advisor-mode/audit-log.js'],
      residual_risks: [],
    },
    ctx,
  );
  assert.equal(evidence.ok, true);

  const gateEvent = { hookEventName: 'PreToolUse', toolName: 'Bash', toolInput: { command: 'rm -rf ./dist' }, taskState: 'implementation', correlationKey: 'corr-producer', taskId: 'task-producer', sessionId: 'sess-producer' };
  const blocked = gate.evaluateGatePolicy(gateEvent, ctx);
  assert.equal(blocked.event, 'advisor_consultation.required');
  writeJson(blocked.recommendationPath, validRecommendation(blocked, blocked.requestPath));
  const humanPacket = gate.evaluateGatePolicy(gateEvent, ctx);
  assert.equal(humanPacket.event, 'human_approval.required');
  gate.writeDisposition(
    { correlationKey: humanPacket.correlationKey, disposition: 'approve', decidedBy: 'operator', rationale: 'Approved.', appliesTo: { event: 'human_approval.required' }, taskId: 'task-producer', sessionId: 'sess-producer' },
    ctx,
  );
  const allowed = gate.evaluateGatePolicy(gateEvent, ctx);
  assert.equal(allowed.gateAction, 'allow');

  const finalGate = evaluateFinalReviewGate({ hookEventName: 'Stop', taskState: 'non-trivial-completion', correlationKey: 'corr-producer', taskId: 'task-producer', sessionId: 'sess-producer' }, ctx);
  assert.equal(finalGate.gateAction, 'block');

  const { events } = readAuditEvents(ctx);
  for (const eventName of [
    'provider_route.executor_call',
    'provider_route.resolved',
    'executor.final_review_decision.recorded',
    'verification.evidence.recorded',
    'advisor.triggered',
    'hook_decision.recorded',
    'human_approval.disposition',
    'final_review_gate.evaluated',
  ]) {
    assert.equal(events.some((event) => event.event === eventName), true, eventName);
  }
  for (const event of events) {
    assert.equal(event.correlationKey, 'corr-producer');
    assert.equal(event.taskId, 'task-producer');
    assert.equal(event.sessionId, 'sess-producer');
  }
});
