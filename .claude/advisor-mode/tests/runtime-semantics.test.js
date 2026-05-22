const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const claudeRoot = path.resolve(__dirname, '..', '..');
const runtimeProbePath = path.join(claudeRoot, 'hooks', 'advisor-runtime-probe.js');
const { buildPermissionDecisionOutput, evaluateDispositionState } = require(runtimeProbePath);

const allowedDispositions = ['approve', 'reject', 'revise', 'defer'];

function makeDispositionRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-runtime-semantics-'));
  const dispositionsDir = path.join(root, '.advisor', 'decisions', 'dispositions');
  fs.mkdirSync(dispositionsDir, { recursive: true });
  return { root, dispositionsDir };
}

function blockedEvent(overrides = {}) {
  return {
    hookEventName: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'rm -rf fixture' },
    correlationKey: 'pretooluse-bash-irreversible-fixture',
    blockedEvent: 'human_approval.required',
    ...overrides,
  };
}

function writeDisposition(dispositionsDir, correlationKey, disposition, overrides = {}) {
  const artifact = {
    correlationKey,
    event: 'human_approval.disposition',
    disposition,
    decidedBy: 'human',
    decidedAt: '2026-05-22T00:00:00.000Z',
    rationale: 'Fixture disposition for explicit retry.',
    appliesTo: {
      event: 'human_approval.required',
    },
    ...overrides,
  };
  fs.writeFileSync(path.join(dispositionsDir, `${correlationKey}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

test('buildPermissionDecisionOutput emits supported PreToolUse host decision fields only', () => {
  const output = buildPermissionDecisionOutput('deny', {
    reason: 'Human approval disposition is required before this workflow path proceeds.',
    additionalContext: 'Advisor Mode local state: blocked-pending-human.',
    updatedInput: { command: 'printf safe-fixture' },
  });

  assert.deepEqual(Object.keys(output).sort(), ['hookSpecificOutput']);
  assert.equal(output.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /Human approval disposition/);
  assert.equal(output.hookSpecificOutput.additionalContext, 'Advisor Mode local state: blocked-pending-human.');
  assert.deepEqual(output.hookSpecificOutput.updatedInput, { command: 'printf safe-fixture' });
  assert.equal('workflowGateStatus' in output.hookSpecificOutput, false);
  assert.equal('correlationKey' in output.hookSpecificOutput, false);
  assert.equal('dispositionPath' in output.hookSpecificOutput, false);
  assert.equal('reentryAllowed' in output.hookSpecificOutput, false);
});

test('custom workflow metadata remains separate from supported host decision payload', () => {
  const hostDecision = buildPermissionDecisionOutput('ask', { reason: 'Probe host decision contract.' });
  const workflowState = evaluateDispositionState(blockedEvent(), makeDispositionRoot());

  assert.equal(hostDecision.hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(hostDecision.hookSpecificOutput.workflowGateStatus, undefined);
  assert.equal(workflowState.workflowGateStatus, 'blocked-pending-human');
  assert.equal(workflowState.correlationKey, 'pretooluse-bash-irreversible-fixture');
  assert.equal(workflowState.retryRequired, true);
  assert.match(workflowState.dispositionPath, /pretooluse-bash-irreversible-fixture\.json$/);
});

test('missing disposition blocks local workflow state and requires explicit retry', () => {
  const state = evaluateDispositionState(blockedEvent(), makeDispositionRoot());

  assert.equal(state.workflowGateStatus, 'blocked-pending-human');
  assert.equal(state.retryRequired, true);
  assert.equal(state.reentryAllowed, false);
  assert.equal(state.disposition, undefined);
});

test('exact approve reject revise defer dispositions satisfy local state for explicit retry', () => {
  for (const disposition of allowedDispositions) {
    const paths = makeDispositionRoot();
    const event = blockedEvent({ correlationKey: `fixture-${disposition}` });
    writeDisposition(paths.dispositionsDir, event.correlationKey, disposition);

    const state = evaluateDispositionState(event, paths);

    assert.equal(state.workflowGateStatus, 'satisfied');
    assert.equal(state.retryRequired, true);
    assert.equal(state.reentryAllowed, true);
    assert.equal(state.disposition, disposition);
    assert.equal(state.correlationKey, event.correlationKey);
  }
});

test('mismatched malformed stale or absent dispositions remain blocked until corrected and retried', () => {
  const mismatchedPaths = makeDispositionRoot();
  const mismatchedEvent = blockedEvent({ correlationKey: 'mismatched-fixture' });
  writeDisposition(mismatchedPaths.dispositionsDir, mismatchedEvent.correlationKey, 'approve', {
    correlationKey: 'different-fixture',
  });
  assert.equal(evaluateDispositionState(mismatchedEvent, mismatchedPaths).workflowGateStatus, 'blocked-pending-human');

  const malformedPaths = makeDispositionRoot();
  const malformedEvent = blockedEvent({ correlationKey: 'malformed-fixture' });
  fs.writeFileSync(path.join(malformedPaths.dispositionsDir, `${malformedEvent.correlationKey}.json`), '{not-json');
  assert.equal(evaluateDispositionState(malformedEvent, malformedPaths).workflowGateStatus, 'blocked-pending-human');

  const stalePaths = makeDispositionRoot();
  const staleEvent = blockedEvent({ correlationKey: 'stale-fixture' });
  writeDisposition(stalePaths.dispositionsDir, staleEvent.correlationKey, 'approve', {
    appliesTo: { event: 'advisor_consultation.required' },
  });
  assert.equal(evaluateDispositionState(staleEvent, stalePaths).workflowGateStatus, 'blocked-pending-human');

  const invalidDispositionPaths = makeDispositionRoot();
  const invalidDispositionEvent = blockedEvent({ correlationKey: 'invalid-disposition-fixture' });
  writeDisposition(invalidDispositionPaths.dispositionsDir, invalidDispositionEvent.correlationKey, 'allow');
  assert.equal(evaluateDispositionState(invalidDispositionEvent, invalidDispositionPaths).workflowGateStatus, 'blocked-pending-human');

  const absentState = evaluateDispositionState(blockedEvent({ correlationKey: 'absent-fixture' }), makeDispositionRoot());
  assert.equal(absentState.workflowGateStatus, 'blocked-pending-human');
});
