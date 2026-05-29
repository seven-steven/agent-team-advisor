const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runtimePath } = require('../runtime-paths.js');
const recovery = require('../operator-recovery.js');
const gate = require('../../hooks/advisor-gate.js');
const { evaluateFinalReviewGate } = require('../../hooks/advisor-final-review-gate.js');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude', 'advisor-mode', 'policy.example.json'), 'utf8'));

function makeTempRoot(hooks = { advisor_mode: true, advisor_mode_strict: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-rollback-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'config.json'), `${JSON.stringify({ hooks }, null, 2)}\n`);
  return root;
}

function readAuditEvents(root) {
  const auditPath = runtimePath(root, ['audit', 'events.jsonl']);
  return fs.readFileSync(auditPath, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
}

function forcePushEvent(overrides = {}) {
  return {
    hookEventName: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'git push --force origin main' },
    taskState: 'implementation',
    correlationKey: 'force-push-recovery',
    ...overrides,
  };
}

function finalReviewEvent(overrides = {}) {
  return {
    hookEventName: 'Stop',
    taskState: 'non-trivial-completion',
    requiresFinalReview: true,
    correlationKey: 'final-review-recovery',
    verdict_ref: '.advisor/verdicts/final-review-recovery.json',
    verification_evidence_ref: '.advisor/evidence/verification/final-review-recovery.json',
    changed_files: ['.claude/hooks/advisor-final-review-gate.js'],
    changed_files_fingerprint: 'fingerprint-recovery',
    ...overrides,
  };
}

function limitedPolicy() {
  return {
    advisorMode: {
      budget: {
        enabled: true,
        overLimitMode: 'degraded',
        scopes: { task: { advisorCalls: 0 }, session: { advisorCalls: 0 } },
      },
      gates: policy.advisorMode.gates,
    },
  };
}

test('readOperatorMode maps config hooks flags to enforce warning-only and disabled modes', () => {
  assert.equal(recovery.readOperatorMode(makeTempRoot({ advisor_mode: true, advisor_mode_strict: true })).mode, 'enforce');
  assert.equal(recovery.readOperatorMode(makeTempRoot({ advisor_mode: true, advisor_mode_strict: false })).mode, 'warning-only');
  assert.equal(recovery.readOperatorMode(makeTempRoot({ advisor_mode: false })).mode, 'disabled');
});

test('evaluateOperatorRecovery exposes layered capability class switches', () => {
  const root = makeTempRoot({
    advisor_mode: true,
    advisor_mode_strict: true,
    advisor_mode_capabilities: {
      advisorConsultation: false,
      finalReview: true,
      criticalHumanApproval: true,
      protectedSurfaces: false,
    },
  });
  const mode = recovery.readOperatorMode(root);

  for (const capability of ['advisorConsultation', 'finalReview', 'criticalHumanApproval', 'protectedSurfaces']) {
    assert.equal(typeof recovery.isCapabilityEnabled(mode, capability), 'boolean', capability);
  }
  assert.equal(recovery.isCapabilityEnabled(mode, 'advisorConsultation'), false);
  assert.equal(recovery.isCapabilityEnabled(mode, 'finalReview'), true);
  assert.equal(recovery.isCapabilityEnabled(mode, 'criticalHumanApproval'), true);
  assert.equal(recovery.isCapabilityEnabled(mode, 'protectedSurfaces'), false);
});

test('degraded over-limit mode downgrades non-critical advisor consultation to advisory', () => {
  const root = makeTempRoot();
  const result = gate.evaluateGatePolicy(
    { toolName: 'Bash', toolInput: { command: 'node --test failing.test.js' }, taskState: 'verification', failureCount: 2, correlationKey: 'degraded-non-critical' },
    { root, policy: limitedPolicy() },
  );

  assert.equal(result.gateAction, 'advisory');
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.reasonCode, 'advisor-budget-exceeded');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, undefined);
});

test('degraded over-limit mode preserves destructive critical human approval gate', () => {
  const root = makeTempRoot();
  const result = gate.evaluateGatePolicy(forcePushEvent(), { root, policy: limitedPolicy() });

  assert.equal(result.gateAction, 'block');
  assert.equal(result.policyRuleId, 'critical-action-human-approval');
  assert.equal(result.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
});

test('degraded over-limit mode preserves strict final review blocking', () => {
  const root = makeTempRoot();
  const result = evaluateFinalReviewGate(finalReviewEvent(), { root, policy: limitedPolicy() });

  assert.equal(result.gateAction, 'block');
  assert.equal(result.reasonCode, 'missing-fresh-final-review');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
});

test('disabled kill-switch returns none without deny for destructive gate', () => {
  const root = makeTempRoot({ advisor_mode: false });
  const result = gate.evaluateGatePolicy(forcePushEvent(), { root, policy });

  assert.equal(result.gateAction, 'none');
  assert.equal(result.reasonCode, 'advisor-mode-disabled');
  assert.equal(result.hookOutput, undefined);
});

test('warning-only mode returns advisory without deny for non-critical advisor gate', () => {
  const root = makeTempRoot({ advisor_mode: true, advisor_mode_strict: false });
  const result = gate.evaluateGatePolicy(
    { toolName: 'Bash', toolInput: { command: 'node --test failing.test.js' }, taskState: 'verification', failureCount: 2, correlationKey: 'warning-only-non-critical' },
    { root, policy },
  );

  assert.equal(result.gateAction, 'advisory');
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, undefined);
});

test('protected surface classification covers policy.example.json governance surface', () => {
  const root = makeTempRoot();
  const result = gate.evaluateGatePolicy(
    {
      toolName: 'Edit',
      toolInput: { file_path: '.claude/advisor-mode/policy.example.json' },
      taskState: 'governance-configuration',
      actionClass: 'governance',
      correlationKey: 'protected-policy-example',
    },
    { root, policy },
  );

  assert.equal(result.policyRuleId, 'protected-surface-human-approval');
  assert.equal(result.auditLabel, 'protected-surface.review');
  assert.equal(result.actionClass, 'governance');
  assert.equal(result.gateAction, 'block');
});

test('recovery mode checks append operator_recovery.mode_checked audit events', () => {
  const root = makeTempRoot({ advisor_mode: true, advisor_mode_strict: false });
  const result = recovery.evaluateOperatorRecovery({ capability: 'advisorConsultation', correlationKey: 'recovery-audit' }, { root });
  const events = readAuditEvents(root);

  assert.equal(result.mode, 'warning-only');
  assert.equal(events.some((event) => event.event === 'operator_recovery.mode_checked'), true);
  const event = events.find((item) => item.event === 'operator_recovery.mode_checked');
  assert.equal(event.mode, 'warning-only');
  assert.equal(event.capabilities.advisorConsultation, true);
});

test('rollback documentation contains exact modes config keys and capability classes', () => {
  const rollback = fs.readFileSync(path.join(repoRoot, '.claude', 'advisor-mode', 'rollback.md'), 'utf8');

  for (const text of ['advisor_mode', 'advisor_mode_strict', 'enforce', 'warning-only', 'disabled/kill-switch']) {
    assert.match(rollback, new RegExp(text.replace('/', '\\/')));
  }
  for (const capability of ['advisorConsultation', 'finalReview', 'criticalHumanApproval', 'protectedSurfaces']) {
    assert.match(rollback, new RegExp(capability));
  }
  for (const protectedPath of ['.planning/config.json', '.claude/hooks/', '.claude/settings.json', '.claude/advisor-mode/*.json']) {
    assert.equal(rollback.includes(protectedPath), true, protectedPath);
  }
});
