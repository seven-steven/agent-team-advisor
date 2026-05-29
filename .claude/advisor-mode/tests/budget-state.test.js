const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runtimePath } = require('../runtime-paths.js');
const { readAuditEvents } = require('../audit-log.js');
const budget = require('../budget-state.js');
const gate = require('../../hooks/advisor-gate.js');
const { evaluateFinalReviewGate } = require('../../hooks/advisor-final-review-gate.js');
const finalReview = require('../final-review.js');

function makeTempRoot(prefix = 'advisor-budget-', hooks = { advisor_mode: true, advisor_mode_strict: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'config.json'), `${JSON.stringify({ hooks }, null, 2)}\n`);
  return root;
}

function budgetPolicy() {
  return {
    schemaVersion: 1,
    advisorMode: {
      budget: {
        enabled: true,
        overLimitMode: 'degraded',
        scopes: {
          task: { advisorCalls: 2, advisorTokens: 1000, advisorLatencyMs: 30000 },
          session: { advisorCalls: 5, advisorTokens: 5000, advisorLatencyMs: 120000 },
        },
      },
      gates: {
        failureThreshold: 2,
        toolClasses: { command: { tools: ['Bash'] }, mutation: { tools: ['Edit', 'Write', 'MultiEdit'] } },
        actionClasses: { governance: { pathPatterns: ['(^|/)\\.claude/advisor-mode/.*\\.json$'] }, lowRisk: { tools: ['Bash'] } },
        pathClasses: { ordinary: { prefixes: [] } },
        rules: [
          {
            id: 'repeated-failure-threshold',
            triggerReason: 'Repeated verification failure requires read-only advisor consultation before continuing.',
            risk: 'high',
            gateAction: 'advisor-consultation',
            when: { toolClass: 'command', taskState: 'verification', failureCountAtLeast: 2 },
          },
        ],
      },
    },
  };
}

function gateEvent(overrides = {}) {
  return {
    hookEventName: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'node --test .claude/advisor-mode/tests/budget-state.test.js' },
    taskState: 'verification',
    failureCount: 2,
    taskId: 'task-budget-1',
    sessionId: 'session-budget-1',
    ...overrides,
  };
}

function writeFinalReviewConfig(root) {
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'config.json'), JSON.stringify({ hooks: { advisor_mode: true, advisor_mode_strict: true } }, null, 2));
}

test('loadBudgetPolicy reads enabled task and session caps', () => {
  const loaded = budget.loadBudgetPolicy({ policy: budgetPolicy() });

  assert.equal(loaded.enabled, true);
  assert.equal(loaded.scopes.task.advisorCalls, 2);
  assert.equal(loaded.scopes.task.advisorTokens, 1000);
  assert.equal(loaded.scopes.task.advisorLatencyMs, 30000);
  assert.equal(loaded.scopes.session.advisorCalls, 5);
  assert.equal(loaded.scopes.session.advisorTokens, 5000);
  assert.equal(loaded.scopes.session.advisorLatencyMs, 120000);
});

test('scopeKeyForBudget supports task and session scope identifiers', () => {
  assert.equal(budget.scopeKeyForBudget({ scope: 'task', taskId: 'task-a', sessionId: 'session-a', correlationKey: 'corr-a' }), 'task:task-a');
  assert.equal(budget.scopeKeyForBudget({ scope: 'session', taskId: 'task-a', sessionId: 'session-a', correlationKey: 'corr-a' }), 'session:session-a');
});

test('evaluateBudget enforces advisor call, token, and latency hard caps across task and session scopes', () => {
  const root = makeTempRoot();
  const policy = budgetPolicy();
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'corr-1', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_verdict', correlationKey: 'corr-2', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 700, advisorLatencyMs: 20000 }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_verdict', correlationKey: 'corr-3', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 400, advisorLatencyMs: 15000 }, { root, policy });

  const result = budget.evaluateBudget({ eventType: 'advisor_call', correlationKey: 'corr-4', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });

  assert.equal(result.ok, false);
  assert.equal(result.degraded, true);
  assert.equal(result.reasonCode, 'advisor-budget-exceeded');
  assert.ok(result.exceeded.some((item) => item.dimension === 'advisorCalls' && item.scope === 'task'));
  assert.ok(result.exceeded.some((item) => item.dimension === 'advisorTokens' && item.scope === 'task'));
  assert.ok(result.exceeded.some((item) => item.dimension === 'advisorLatencyMs' && item.scope === 'task'));
  assert.ok(result.exceeded.some((item) => item.scope === 'task' && item.limit === 1000 && item.actual === 1100));
  assert.equal(fs.existsSync(runtimePath(root, ['state', 'advisor-budget.json'])), true);
  assert.equal(fs.existsSync(path.join(root, '.planning', 'advisor-budget.json')), false);
});

test('recordAdvisorUsage increments calls for fresh consultations and verdicts but not satisfied retries', () => {
  const root = makeTempRoot();
  const policy = budgetPolicy();
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'corr-fresh', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'corr-fresh', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_verdict', correlationKey: 'corr-verdict', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_retry', workflowGateStatus: 'satisfied', correlationKey: 'corr-fresh', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });

  const state = budget.readBudgetState({ root });
  assert.equal(state.scopes['task:task-budget-1'].advisorCalls, 2);
  assert.equal(state.scopes['session:session-budget-1'].advisorCalls, 2);
});

test('non-critical gate degrades to advisory and audits when budget is exceeded', () => {
  const root = makeTempRoot('advisor-budget-gate-', { advisor_mode: true, advisor_mode_strict: false });
  const policy = budgetPolicy();
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'prior-1', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'prior-2', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });

  const result = gate.evaluateGatePolicy(gateEvent(), { root, policy });
  const audit = readAuditEvents({ root });

  assert.equal(result.gateAction, 'advisory');
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.reasonCode, 'advisor-budget-exceeded');
  assert.notEqual(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
  assert.ok(audit.events.some((event) => event.event === 'budget.exceeded'));
});

test('ordinary recommendation usage metadata changes later budget decisions', () => {
  const root = makeTempRoot('advisor-budget-ordinary-', { advisor_mode: true, advisor_mode_strict: false });
  const policy = budgetPolicy();

  gate.recordAdvisorArtifactUsage({ eventType: 'advisor_recommendation', correlationKey: 'ordinary-1', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 700, advisorLatencyMs: 20000 }, { root, policy });
  gate.recordAdvisorArtifactUsage({ eventType: 'advisor_verdict', correlationKey: 'ordinary-2', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 400, advisorLatencyMs: 15000 }, { root, policy });
  const state = budget.readBudgetState({ root });

  assert.equal(state.scopes['task:task-budget-1'].advisorTokens, 1100);
  assert.equal(state.scopes['task:task-budget-1'].advisorLatencyMs, 35000);
  const result = gate.evaluateGatePolicy(gateEvent(), { root, policy });
  assert.equal(result.reasonCode, 'advisor-budget-exceeded');
  assert.equal(result.budgetStatus.ok, false);
});

test('evaluateFinalReviewGate preserves mandatory final review and audits budget status', () => {
  const root = makeTempRoot('advisor-budget-final-');
  writeFinalReviewConfig(root);
  const policy = budgetPolicy();
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'prior-1', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  budget.recordAdvisorUsage({ eventType: 'advisor_call', correlationKey: 'prior-2', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });

  const result = evaluateFinalReviewGate({ taskState: 'non-trivial-completion', correlationKey: 'final-budget-1', taskId: 'task-budget-1', sessionId: 'session-budget-1' }, { root, policy });
  const audit = readAuditEvents({ root });

  assert.equal(result.gateAction, 'block');
  assert.equal(result.budgetStatus.reasonCode, 'advisor-budget-exceeded');
  assert.equal(result.budgetStatus.eventType, 'advisor_final_review');
  assert.ok(audit.events.some((event) => event.event === 'budget.exceeded' && event.eventType === 'advisor_final_review'));
});

test('final-review verdict recording increments task and session usage once with metadata', () => {
  const root = makeTempRoot('advisor-budget-verdict-');
  const policy = budgetPolicy();
  const first = finalReview.recordFinalReviewVerdictUsage({ correlationKey: 'final-verdict-1', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 800, advisorLatencyMs: 25000 }, { root, policy });
  const second = finalReview.recordFinalReviewVerdictUsage({ correlationKey: 'final-verdict-1', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 800, advisorLatencyMs: 25000 }, { root, policy });
  const state = budget.readBudgetState({ root });

  assert.equal(first.recorded, true);
  assert.equal(second.recorded, false);
  assert.equal(state.scopes['task:task-budget-1'].advisorCalls, 1);
  assert.equal(state.scopes['task:task-budget-1'].advisorTokens, 800);
  assert.equal(state.scopes['session:session-budget-1'].advisorLatencyMs, 25000);
});


test('ordinary advisor recommendation artifact re-read is idempotent', () => {
  const root = makeTempRoot('advisor-budget-idempotent-');
  const policy = budgetPolicy();
  const artifact = { eventType: 'advisor_recommendation', correlationKey: 'ordinary-once', taskId: 'task-budget-1', sessionId: 'session-budget-1', advisorTokens: 700, advisorLatencyMs: 20000, artifactPath: '.advisor/consultations/recommendations/ordinary-once.json' };

  gate.recordAdvisorArtifactUsage(artifact, { root, policy });
  gate.recordAdvisorArtifactUsage(artifact, { root, policy });
  const state = budget.readBudgetState({ root });

  assert.equal(state.scopes['task:task-budget-1'].advisorCalls, 1);
  assert.equal(state.scopes['task:task-budget-1'].advisorTokens, 700);
  assert.equal(state.scopes['task:task-budget-1'].advisorLatencyMs, 20000);
});

test('final-review verdict re-read is idempotent even when metadata is missing', () => {
  const root = makeTempRoot('advisor-budget-final-idempotent-');
  const policy = budgetPolicy();

  finalReview.recordFinalReviewVerdictUsage({ correlationKey: 'final-unknown', taskId: 'task-budget-1', sessionId: 'session-budget-1', usageSource: 'unknown' }, { root, policy });
  finalReview.recordFinalReviewVerdictUsage({ correlationKey: 'final-unknown', taskId: 'task-budget-1', sessionId: 'session-budget-1', usageSource: 'unknown' }, { root, policy });
  const state = budget.readBudgetState({ root });

  assert.equal(state.scopes['task:task-budget-1'].advisorCalls, 1);
  assert.equal(state.scopes['task:task-budget-1'].advisorTokens, 0);
  assert.equal(state.scopes['task:task-budget-1'].advisorLatencyMs, 0);
});
