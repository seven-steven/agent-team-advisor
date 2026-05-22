const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const gate = require('../../hooks/advisor-gate.js');
const failureTracker = require('../../hooks/advisor-failure-tracker.js');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const settingsPath = path.join(repoRoot, '.claude', 'settings.json');
const gitignorePath = path.join(repoRoot, '.gitignore');
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude', 'advisor-mode', 'policy.example.json'), 'utf8'));
const d10DecisionClasses = ['irreversible', 'security-boundary', 'shared-production', 'governance-configuration'];
const d13Dispositions = ['approve', 'reject', 'revise', 'defer'];

function makeTempRoot(prefix = 'advisor-human-gate-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.advisor', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.advisor', 'audit'), { recursive: true });
  fs.mkdirSync(path.join(root, '.advisor', 'consultations', 'requests'), { recursive: true });
  fs.mkdirSync(path.join(root, '.advisor', 'consultations', 'recommendations'), { recursive: true });
  fs.mkdirSync(path.join(root, '.advisor', 'decisions', 'dispositions'), { recursive: true });
  return root;
}

function failurePayload(overrides = {}) {
  return {
    hookEventName: 'PostToolUse',
    toolName: 'Bash',
    toolInput: { command: 'node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js' },
    toolResponse: {
      exitCode: 1,
      stderr:
        'Error: ENOENT at /tmp/advisor-12345/work/file.js:42:17 on 2026-05-22T01:02:03.000Z id abcdef1234567890abcdef1234567890',
      stdout: '',
    },
    taskState: 'verification',
    actionClass: 'test-run',
    ...overrides,
  };
}

function decisionInput(decisionClass, root, overrides = {}) {
  const correlationKey = `human-gate-${decisionClass.replace(/[^a-z0-9-]/g, '-')}`;
  return {
    correlationKey,
    triggerReason: `${decisionClass} decision requires human approval`,
    decisionSummary: `Executor proposes a ${decisionClass} change`,
    riskLevel: 'critical',
    decisionClass,
    expectedConsequences: ['The executor will retry only after a disposition artifact exists.'],
    suggestedVerificationPoints: ['Confirm the disposition artifact before retrying the blocked action.'],
    root,
    ...overrides,
  };
}

function validRecommendation(input, requestPath = '') {
  return {
    correlationKey: input.correlationKey,
    source: 'read-only-advisor',
    advisorAgent: 'advisor-reviewer',
    status: 'CONCERNS',
    risk: input.riskLevel,
    confidence: 'high',
    recommendation: 'Ask the human operator to choose approve, reject, revise, or defer before retry.',
    rationale: 'This is a critical decision class and executor authority must remain separate from human approval.',
    blockingFindings: [],
    recommendedActions: ['Collect an explicit human disposition artifact.'],
    verificationGuidance: ['Retry the blocked action only after disposition validation succeeds.'],
    requestPath,
  };
}

function writeRecommendation(root, input, recommendation = validRecommendation(input)) {
  const recommendationPath = path.join(root, '.advisor', 'consultations', 'recommendations', `${input.correlationKey}.json`);
  fs.mkdirSync(path.dirname(recommendationPath), { recursive: true });
  fs.writeFileSync(recommendationPath, `${JSON.stringify(recommendation, null, 2)}\n`);
  return recommendationPath;
}

function allHookCommands(settings, eventName) {
  return (settings.hooks[eventName] || []).flatMap((entry) =>
    (entry.hooks || []).map((hook) => ({ matcher: entry.matcher || '', command: hook.command || '' })),
  );
}

function isIgnored(relativePath) {
  try {
    execFileSync('git', ['check-ignore', '-q', relativePath], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('two identical normalized failures escalate at threshold 2 and require advisor disposition', () => {
  const root = makeTempRoot('advisor-failure-threshold-');
  const first = failureTracker.trackFailure(failurePayload(), { root });
  const second = failureTracker.trackFailure(failurePayload(), { root });

  assert.equal(first.count, 1);
  assert.equal(first.requiresAdvisorConsultation, false);
  assert.equal(first.requiresAdvisorDisposition, false);
  assert.equal(second.count, 2);
  assert.equal(second.event, 'advisor_consultation.required');
  assert.equal(second.requiresAdvisorConsultation, true);
  assert.equal(second.requiresAdvisorDisposition, true);
  assert.equal(second.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(second.retryRequired, true);

  const state = JSON.parse(fs.readFileSync(path.join(root, '.advisor', 'state', 'failure-signatures.json'), 'utf8'));
  assert.equal(state.signatures[second.signature].count, 2);
  assert.equal(fs.existsSync(path.join(root, '.advisor', 'audit', 'events.jsonl')), true);
  assert.equal(fs.existsSync(path.join(root, '.planning', 'failure-signatures.json')), false);
});

test('failure normalization strips volatile data while preserving material classes', () => {
  const a = failureTracker.normalizeFailureSignature(
    failurePayload({
      toolResponse: {
        exitCode: 1,
        stderr:
          'TypeError: ENOENT at /home/seven/project/src/file.js:10:22 tmp/advisor-A1B2C3 2026-05-22T01:02:03Z hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa id 12345',
      },
    }),
  );
  const b = failureTracker.normalizeFailureSignature(
    failurePayload({
      toolResponse: {
        exitCode: 1,
        stderr:
          'TypeError: ENOENT at /var/folders/random/src/file.js:987:1 tmp/advisor-Z9Y8X7 2027-09-10T11:12:13Z hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb id 67890',
      },
    }),
  );
  const differentExit = failureTracker.normalizeFailureSignature(
    failurePayload({ toolResponse: { exitCode: 2, stderr: 'TypeError at /tmp/other.js:1:1 id 999' } }),
  );

  assert.equal(a, b);
  assert.notEqual(a, differentExit);
  assert.match(a, /tool:Bash/);
  assert.match(a, /exit:1/);
  assert.match(a, /action:test-run/);
  assert.match(a, /error:TypeError/);
  assert.doesNotMatch(a, /home|var|2026|2027|aaaaaaaa|bbbbbbbb|12345|67890|:10|:987/);
});

test('evaluateGatePolicy reads persisted repeated failure state using tracker signature key', () => {
  const root = makeTempRoot('advisor-failure-evaluate-');
  const payload = failurePayload();
  failureTracker.trackFailure(payload, { root });
  const tracked = failureTracker.trackFailure(payload, { root });
  const trackerSignature = failureTracker.normalizeFailureSignature(payload);

  assert.equal(tracked.signature, trackerSignature);
  const state = JSON.parse(fs.readFileSync(path.join(root, '.advisor', 'state', 'failure-signatures.json'), 'utf8'));
  assert.equal(state.signatures[trackerSignature].count, 2);

  const result = gate.evaluateGatePolicy(
    {
      hookEventName: 'PreToolUse',
      toolName: payload.toolName,
      toolInput: payload.toolInput,
      toolResponse: payload.toolResponse,
      taskState: payload.taskState,
      actionClass: payload.actionClass,
      failureCount: 2,
    },
    { root, policy },
  );

  assert.equal(result.gateAction, 'block');
  assert.equal(result.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(result.policyRuleId, 'repeated-failure-threshold');
  assert.equal(result.failureSignature, trackerSignature);
  assert.equal(result.failureCount, 2);
});

test('critical D-10 classes emit human approval only after matching advisor recommendation exists', () => {
  const root = makeTempRoot();
  for (const decisionClass of d10DecisionClasses) {
    const input = decisionInput(decisionClass, root);
    const blocked = gate.buildDecisionPacket(input, { root });

    assert.equal(blocked.event, 'advisor_consultation.required');
    assert.equal(blocked.workflowGateStatus, 'blocked-pending-advisor');
    assert.equal(blocked.retryRequired, true);
    assert.equal(blocked.advisorRecommendation, undefined);

    writeRecommendation(root, input, validRecommendation(input, blocked.requestPath));
    const packet = gate.buildDecisionPacket(input, { root });

    assert.equal(packet.event, 'human_approval.required');
    assert.equal(packet.workflowGateStatus, 'blocked-pending-human');
    assert.equal(packet.retryRequired, true);
    assert.equal(packet.reentryAllowed, false);
    assert.equal(packet.decisionClass, decisionClass);
    assert.equal(packet.advisorRecommendation.correlationKey, input.correlationKey);
  }
});

test('evaluateGatePolicy routes destructive force-push credential and production actions to human approval retry', () => {
  const root = makeTempRoot('advisor-critical-evaluate-');
  const cases = [
    {
      name: 'destructive',
      event: { toolName: 'Bash', toolInput: { command: 'rm -rf ./dist' }, taskState: 'irreversible' },
      expectedActionClass: 'destructive',
    },
    {
      name: 'force-push',
      event: { toolName: 'Bash', toolInput: { command: 'git push --force origin main' }, taskState: 'irreversible' },
      expectedActionClass: 'destructive',
    },
    {
      name: 'credential',
      event: { toolName: 'Edit', toolInput: { file_path: '.claude/advisor-mode/credentials.example.json' }, taskState: 'security-boundary' },
      expectedActionClass: 'credential-control',
    },
    {
      name: 'production',
      event: { toolName: 'Bash', toolInput: { command: 'kubectl apply -f production.yaml' }, taskState: 'shared-production' },
      expectedActionClass: 'production-affecting',
    },
  ];

  for (const testCase of cases) {
    const first = gate.evaluateGatePolicy(testCase.event, { root, policy });
    assert.equal(first.event, 'advisor_consultation.required', testCase.name);
    assert.equal(first.workflowGateStatus, 'blocked-pending-advisor', testCase.name);
    assert.equal(first.actionClass, testCase.expectedActionClass, testCase.name);

    writeRecommendation(
      root,
      { correlationKey: first.correlationKey, riskLevel: first.risk, decisionClass: first.actionClass },
      validRecommendation({ correlationKey: first.correlationKey, riskLevel: first.risk }, first.requestPath),
    );
    const packet = gate.evaluateGatePolicy(testCase.event, { root, policy });
    assert.equal(packet.event, 'human_approval.required', testCase.name);
    assert.equal(packet.workflowGateStatus, 'blocked-pending-human', testCase.name);

    for (const disposition of d13Dispositions) {
      gate.writeDisposition(
        {
          correlationKey: packet.correlationKey,
          disposition,
          decidedBy: 'human-operator',
          rationale: `${disposition} ${testCase.name}`,
          appliesTo: { event: packet.event },
        },
        { root },
      );
      const retry = gate.evaluateGatePolicy(testCase.event, { root, policy });
      assert.equal(retry.gateAction, 'allow', testCase.name);
      assert.equal(retry.workflowGateStatus, 'satisfied', testCase.name);
      assert.equal(retry.reentryAllowed, true, testCase.name);
      assert.equal(retry.disposition, disposition, testCase.name);
    }
  }
});

test('implementation-state force-push critical-action-human-approval through evaluateGatePolicy requires human_approval.required then disposition retry', () => {
  const root = makeTempRoot('advisor-implementation-force-push-');
  const event = {
    hookEventName: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'git push --force origin main' },
    taskState: 'implementation',
  };

  const first = gate.evaluateGatePolicy(event, { root, policy });
  assert.equal(first.event, 'advisor_consultation.required');
  assert.equal(first.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(first.policyRuleId, 'critical-action-human-approval');
  assert.equal(first.actionClass, 'destructive');

  writeRecommendation(
    root,
    { correlationKey: first.correlationKey, riskLevel: first.risk },
    validRecommendation({ correlationKey: first.correlationKey, riskLevel: first.risk }, first.requestPath),
  );
  const recommendationOnly = gate.evaluateGatePolicy(event, { root, policy });
  assert.equal(recommendationOnly.event, 'human_approval.required');
  assert.equal(recommendationOnly.gateAction, 'block');
  assert.equal(recommendationOnly.workflowGateStatus, 'blocked-pending-human');
  assert.equal(recommendationOnly.retryRequired, true);
  assert.equal(recommendationOnly.reentryAllowed, false);

  for (const disposition of d13Dispositions) {
    gate.writeDisposition(
      {
        correlationKey: recommendationOnly.correlationKey,
        disposition,
        decidedBy: 'human-operator',
        rationale: `${disposition} implementation-state git push --force`,
        appliesTo: { event: recommendationOnly.event },
      },
      { root },
    );
    const retry = gate.evaluateGatePolicy(event, { root, policy });
    assert.equal(retry.gateAction, 'allow');
    assert.equal(retry.workflowGateStatus, 'satisfied');
    assert.equal(retry.reentryAllowed, true);
    assert.equal(retry.disposition, disposition);
  }
});

test('human packet includes D-12 fields non-null advisor recommendation and explicit retry', () => {
  const root = makeTempRoot();
  const input = decisionInput('security-boundary', root);
  const missing = gate.buildDecisionPacket(input, { root });
  writeRecommendation(root, input, validRecommendation(input, missing.requestPath));
  const packet = gate.buildDecisionPacket(input, { root });

  for (const field of [
    'triggerReason',
    'decisionSummary',
    'riskLevel',
    'options',
    'advisorRecommendation',
    'expectedConsequences',
    'suggestedVerificationPoints',
    'correlationKey',
    'event',
    'workflowGateStatus',
    'dispositionPath',
    'retryRequired',
  ]) {
    assert.notEqual(packet[field], undefined, `${field} should be present`);
  }

  assert.equal(packet.event, 'human_approval.required');
  assert.equal(packet.retryRequired, true);
  assert.notEqual(packet.advisorRecommendation, null, 'advisorRecommendation must not be nullable');
  assert.equal(packet.options.length, 4);
  assert.deepEqual(packet.options.map((option) => option.disposition), d13Dispositions);

  const nullable = validRecommendation(input, missing.requestPath);
  writeRecommendation(root, input, { ...nullable, recommendation: null });
  const rejected = gate.buildDecisionPacket(input, { root });
  assert.equal(rejected.event, 'advisor_consultation.required');
  assert.equal(rejected.workflowGateStatus, 'blocked-pending-advisor');
});

test('writeDisposition persists approve reject revise defer under disposition runtime path', () => {
  const root = makeTempRoot();
  for (const disposition of d13Dispositions) {
    const correlationKey = `human-disposition-${disposition}`;
    const artifact = gate.writeDisposition(
      {
        correlationKey,
        disposition,
        decidedBy: 'human-operator',
        rationale: `Operator selected ${disposition}.`,
        appliesTo: { event: 'human_approval.required' },
        conditions: disposition === 'revise' || disposition === 'defer' ? ['Return with updated scope.'] : undefined,
      },
      { root },
    );

    assert.equal(artifact.event, 'human_approval.disposition');
    assert.equal(artifact.disposition, disposition);
    assert.match(artifact.path, new RegExp(`\\.advisor/decisions/dispositions/${correlationKey}\\.json$`));
    const stored = JSON.parse(fs.readFileSync(artifact.path, 'utf8'));
    assert.equal(stored.disposition, disposition);
  }
});

test('human re-entry blocks absent malformed mismatched stale dispositions and satisfies matching disposition', () => {
  const root = makeTempRoot();
  const input = decisionInput('irreversible', root, { correlationKey: 'human-reentry-fixture' });
  const missing = gate.buildDecisionPacket(input, { root });
  writeRecommendation(root, input, validRecommendation(input, missing.requestPath));
  const packet = gate.buildDecisionPacket(input, { root });

  assert.equal(gate.evaluateHumanGateReentry(packet, { root }).workflowGateStatus, 'blocked-pending-human');

  fs.writeFileSync(packet.dispositionPath, '{bad json');
  assert.equal(gate.evaluateHumanGateReentry(packet, { root }).workflowGateStatus, 'blocked-pending-human');

  gate.writeDisposition(
    {
      correlationKey: 'different-correlation',
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Wrong decision artifact.',
      appliesTo: { event: 'human_approval.required' },
    },
    { root, dispositionPath: packet.dispositionPath },
  );
  assert.equal(gate.evaluateHumanGateReentry(packet, { root }).workflowGateStatus, 'blocked-pending-human');

  gate.writeDisposition(
    {
      correlationKey: packet.correlationKey,
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Stale event target.',
      appliesTo: { event: 'advisor_consultation.required' },
    },
    { root },
  );
  assert.equal(gate.evaluateHumanGateReentry(packet, { root }).workflowGateStatus, 'blocked-pending-human');

  gate.writeDisposition(
    {
      correlationKey: packet.correlationKey,
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Valid approval.',
      appliesTo: { event: 'human_approval.required' },
    },
    { root },
  );
  const satisfied = gate.evaluateHumanGateReentry(packet, { root });
  assert.equal(satisfied.workflowGateStatus, 'satisfied');
  assert.equal(satisfied.reentryAllowed, true);
  assert.equal(satisfied.retryRequired, true);
  assert.equal(satisfied.requiresExplicitRetry, true);
});

test('valid disposition still requires explicit retry and never models host wait-and-resume', () => {
  const root = makeTempRoot();
  const input = decisionInput('governance-configuration', root, { correlationKey: 'explicit-retry-fixture' });
  const missing = gate.buildDecisionPacket(input, { root });
  writeRecommendation(root, input, validRecommendation(input, missing.requestPath));
  const packet = gate.buildDecisionPacket(input, { root });
  gate.writeDisposition(
    {
      correlationKey: packet.correlationKey,
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Approved with explicit retry.',
      appliesTo: { event: packet.event },
    },
    { root },
  );

  const reentry = gate.evaluateHumanGateReentry(packet, { root });
  assert.equal(reentry.workflowGateStatus, 'satisfied');
  assert.equal(reentry.retryRequired, true);
  assert.equal(reentry.requiresExplicitRetry, true);
  assert.equal(reentry.hostWaitAndResume, false);
});

test('settings wires one failure tracker PostToolUse command and preserves existing hooks', () => {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const postToolCommands = allHookCommands(settings, 'PostToolUse');
  const failureTrackerCommands = postToolCommands.filter(({ command }) => command.includes('advisor-failure-tracker.js'));

  assert.equal(failureTrackerCommands.length, 1);
  assert.equal(failureTrackerCommands[0].matcher, 'Bash|Edit|Write|MultiEdit|Agent|Task');
  assert.equal(postToolCommands.some(({ command }) => command.includes('gsd-context-monitor.js')), true);
  assert.equal(postToolCommands.some(({ command }) => command.includes('advisor-install-audit.js')), true);
});

test('runtime audit state and disposition artifacts are ignored outside planning', () => {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  assert.match(gitignore, /^\.advisor\/audit\/\*\.jsonl$/m);
  assert.match(gitignore, /^\.advisor\/state\/\*\.json$/m);
  assert.match(gitignore, /^\.advisor\/decisions\/dispositions\/\*\.json$/m);
  assert.match(gitignore, /^!\.advisor\/decisions\/dispositions\/\.gitkeep$/m);

  for (const artifact of [
    '.advisor/audit/events.jsonl',
    '.advisor/state/failure-signatures.json',
    '.advisor/decisions/dispositions/example.json',
  ]) {
    assert.equal(isIgnored(artifact), true, `${artifact} should be ignored`);
    assert.equal(artifact.startsWith('.planning/'), false);
  }
});
