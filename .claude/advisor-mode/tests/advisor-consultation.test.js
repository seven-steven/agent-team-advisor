const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gate = require('../../hooks/advisor-gate.js');
const settingsPath = path.resolve(__dirname, '..', '..', 'settings.json');

function makeTempRoot(hooks = { advisor_mode: true, advisor_mode_strict: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-consultation-'));
  fs.mkdirSync(path.join(root, '.advisor', 'consultations', 'requests'), { recursive: true });
  fs.mkdirSync(path.join(root, '.advisor', 'consultations', 'recommendations'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'advisor-mode'), { recursive: true });
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.planning', 'config.json'),
    JSON.stringify({ hooks }, null, 2) + '\n',
  );
  fs.copyFileSync(
    path.resolve(__dirname, '..', 'policy.example.json'),
    path.join(root, '.claude', 'advisor-mode', 'policy.example.json'),
  );
  return root;
}

function highRiskBashEvent(overrides = {}) {
  return {
    hookEventName: 'PreToolUse',
    toolName: 'Bash',
    toolInput: {
      command: 'git push --force origin main',
      file_path: '.claude/settings.json',
    },
    taskState: 'implementation',
    failureCount: 0,
    ...overrides,
  };
}

function highRiskEditEvent(toolName = 'Edit') {
  return {
    hookEventName: 'PreToolUse',
    toolName,
    toolInput: {
      file_path: '.claude/settings.json',
      old_string: 'x',
      new_string: 'y',
    },
    taskState: 'implementation',
    failureCount: 0,
  };
}

function validRecommendation(request, overrides = {}) {
  return {
    correlationKey: request.correlationKey,
    source: 'read-only-advisor',
    advisorAgent: 'advisor-reviewer',
    status: 'CONCERNS',
    risk: request.risk,
    confidence: 'high',
    recommendation: 'Proceed only after executor verifies the high-risk change is intentional.',
    rationale: 'The tool event touches protected workflow state.',
    blockingFindings: [],
    recommendedActions: ['Executor reviews the request artifact before retrying.'],
    verificationGuidance: ['Run the relevant test command after retry.'],
    requestPath: request.requestPath,
    ...overrides,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function allHookCommands(settings, eventName) {
  return (settings.hooks[eventName] || []).flatMap((entry) =>
    (entry.hooks || []).map((hook) => ({ matcher: entry.matcher || '', command: hook.command || '' })),
  );
}

test('advisor gate stays inert when advisor mode is disabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-consultation-disabled-'));
  fs.mkdirSync(path.join(root, '.claude', 'advisor-mode'), { recursive: true });
  fs.copyFileSync(
    path.resolve(__dirname, '..', 'policy.example.json'),
    path.join(root, '.claude', 'advisor-mode', 'policy.example.json'),
  );

  const result = gate.evaluateGatePolicy(highRiskBashEvent(), { root });

  assert.equal(result.gateAction, 'none');
  assert.equal(result.reasonCode, 'advisor-mode-disabled');
});

test('soft mode returns advisory instead of deny/block for high-risk hooks', () => {
  const root = makeTempRoot({ advisor_mode: true, advisor_mode_strict: false });
  const result = gate.evaluateGatePolicy(highRiskBashEvent(), { root });

  assert.equal(result.gateAction, 'advisory');
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.workflowGateStatus, 'advisory-pending-advisor');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, undefined);
  assert.match(result.hookOutput.hookSpecificOutput.additionalContext, /Advisor request:/i);
});

test('high-risk configured tools block first attempt and create deterministic consultation paths', () => {
  for (const toolName of ['Bash', 'Edit', 'Write', 'MultiEdit']) {
    const root = makeTempRoot();
    const event = toolName === 'Bash' ? highRiskBashEvent() : highRiskEditEvent(toolName);
    const result = gate.evaluateGatePolicy(event, { root });

    assert.equal(result.gateAction, 'block');
    assert.equal(result.workflowGateStatus, 'blocked-pending-advisor');
    assert.equal(result.retryRequired, true);
    assert.equal(result.hookOutput.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(result.hookOutput.hookSpecificOutput.permissionDecisionReason, /advisor/i);
    assert.match(result.correlationKey, /^advisor-consultation-[a-f0-9]{24}$/);
    assert.equal(result.requestPath.includes('/consultations/requests/'), true);
    assert.equal(
      result.recommendationPath.includes('/consultations/recommendations/'),
      true,
    );
    assert.equal(fs.existsSync(result.requestPath), true);

    const secondResult = gate.evaluateGatePolicy(event, { root });
    assert.equal(secondResult.correlationKey, result.correlationKey);
    assert.equal(secondResult.requestPath, result.requestPath);
    assert.equal(secondResult.recommendationPath, result.recommendationPath);
  }
});

test('request artifact includes executor-triggered read-only advisor producer handoff', () => {
  const root = makeTempRoot();
  const result = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  const request = JSON.parse(fs.readFileSync(result.requestPath, 'utf8'));

  assert.equal(request.event, 'advisor_consultation.required');
  assert.equal(request.correlationKey, result.correlationKey);
  assert.equal(request.consultationTiming, 'before-proceed');
  assert.equal(request.advisorProducer.surface, 'subagent-or-SendMessage');
  assert.equal(request.advisorProducer.agent, 'advisor-reviewer');
  assert.equal(request.advisorProducer.inputPath, result.requestPath);
  assert.equal(request.advisorProducer.outputPath, result.recommendationPath);
  assert.match(request.advisorProducer.instruction, /executor/i);
  assert.match(request.advisorProducer.instruction, /read-only advisor-reviewer/i);
  assert.doesNotMatch(request.advisorProducer.instruction, /\b(Bash|Edit|Write|MultiEdit)\b/);
});

test('missing malformed or mismatched recommendations keep explicit retry blocked', () => {
  const root = makeTempRoot();
  const blocked = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  assert.equal(blocked.workflowGateStatus, 'blocked-pending-advisor');

  const missing = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  assert.equal(missing.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(missing.retryRequired, true);
  assert.equal(missing.reentryAllowed, false);

  fs.mkdirSync(path.dirname(blocked.recommendationPath), { recursive: true });
  fs.writeFileSync(blocked.recommendationPath, '{bad json');
  const malformed = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  assert.equal(malformed.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(malformed.reasonCode, 'invalid-recommendation-json');

  const request = JSON.parse(fs.readFileSync(blocked.requestPath, 'utf8'));
  writeJson(blocked.recommendationPath, validRecommendation(request, { correlationKey: 'wrong-key' }));
  const mismatched = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  assert.equal(mismatched.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(mismatched.reasonCode, 'invalid-recommendation-artifact');
});

test('implementation-state git push --force critical-action-human-approval stays human_approval.required until disposition retry', () => {
  const root = makeTempRoot();
  const event = highRiskBashEvent();
  const blocked = gate.evaluateGatePolicy(event, { root });
  const request = JSON.parse(fs.readFileSync(blocked.requestPath, 'utf8'));
  writeJson(blocked.recommendationPath, validRecommendation(request));

  const recommendationOnly = gate.evaluateGatePolicy(event, { root });
  assert.equal(recommendationOnly.event, 'human_approval.required');
  assert.equal(recommendationOnly.gateAction, 'block');
  assert.equal(recommendationOnly.workflowGateStatus, 'blocked-pending-human');
  assert.equal(recommendationOnly.retryRequired, true);
  assert.equal(recommendationOnly.reentryAllowed, false);

  gate.writeDisposition(
    {
      correlationKey: recommendationOnly.correlationKey,
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Approve implementation-state git push --force retry.',
      appliesTo: {
        event: recommendationOnly.event,
        requestPath: recommendationOnly.approvalContext.requestPath,
        recommendationDigest: recommendationOnly.approvalContext.recommendationDigest,
      },
    },
    { root },
  );
  const retry = gate.evaluateGatePolicy(event, { root });
  assert.equal(retry.gateAction, 'allow');
  assert.equal(retry.workflowGateStatus, 'satisfied');
  assert.equal(retry.retryRequired, true);
  assert.equal(retry.reentryAllowed, true);
  assert.equal(retry.disposition, 'approve');
});

test('human approval disposition must match the current advisor recommendation version before retry is unlocked', () => {
  const root = makeTempRoot();
  const event = highRiskBashEvent();
  const first = gate.evaluateGatePolicy(event, { root });
  const firstRequest = JSON.parse(fs.readFileSync(first.requestPath, 'utf8'));
  writeJson(first.recommendationPath, validRecommendation(firstRequest));

  const packet = gate.evaluateGatePolicy(event, { root });
  assert.equal(packet.event, 'human_approval.required');
  assert.equal(packet.workflowGateStatus, 'blocked-pending-human');

  gate.writeDisposition(
    {
      correlationKey: packet.correlationKey,
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Approve only the first advisor recommendation.',
      appliesTo: {
        event: packet.event,
        requestPath: packet.advisorRecommendation.requestPath,
        recommendationDigest: gate.getRecommendationDigest(packet.advisorRecommendation),
      },
    },
    { root },
  );
  const satisfied = gate.evaluateGatePolicy(event, { root });
  assert.equal(satisfied.gateAction, 'allow');
  assert.equal(satisfied.workflowGateStatus, 'satisfied');

  writeJson(
    packet.approvalContext.recommendationPath,
    validRecommendation(firstRequest, {
      recommendation: 'A refreshed advisor review changed the recommendation body.',
      rationale: 'The request was reconsidered and needs a fresh human disposition.',
    }),
  );

  const replayAttempt = gate.evaluateGatePolicy(event, { root });
  assert.equal(replayAttempt.event, 'human_approval.required');
  assert.equal(replayAttempt.workflowGateStatus, 'blocked-pending-human');
  assert.equal(replayAttempt.reentryAllowed, false);
  assert.equal(replayAttempt.reasonCode, 'invalid-disposition-artifact');
});

test('policy evaluation combines tool path action failure count and task state dimensions', () => {
  const root = makeTempRoot();
  const policy = gate.loadPolicy({ root });

  assert.equal(gate.classifyToolClass('Bash', { command: 'git push --force origin main' }, policy), 'command');
  assert.equal(gate.classifyActionClass('Bash', { command: 'git push --force origin main' }, policy), 'destructive');
  assert.equal(gate.classifyPathClass('Edit', { file_path: '.claude/settings.json' }, policy), 'claude-settings');

  const failureResult = gate.evaluateGatePolicy(
    {
      hookEventName: 'PreToolUse',
      toolName: 'Bash',
      toolInput: { command: 'npm test' },
      taskState: 'verification',
      failureCount: 2,
    },
    { root },
  );
  assert.equal(failureResult.gateAction, 'block');
  assert.equal(failureResult.policyRuleId, 'repeated-failure-threshold');
});

test('malformed host payloads and missing tool names fail open without artifacts', () => {
  const root = makeTempRoot();
  const malformed = gate.buildGateEvent('not-an-object');
  const missingTool = gate.evaluateGatePolicy({ hookEventName: 'PreToolUse', toolInput: {} }, { root });

  assert.equal(malformed.failOpen, true);
  assert.equal(missingTool.gateAction, 'none');
  assert.equal(missingTool.failOpen, true);
  assert.deepEqual(fs.readdirSync(path.join(root, '.advisor', 'consultations', 'requests')), []);
});

test('missing policy for configured matcher event hard-stops with stable policy-load-failed reason', () => {
  const root = makeTempRoot();
  fs.rmSync(path.join(root, '.claude', 'advisor-mode', 'policy.example.json'));

  const result = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  assert.equal(result.gateAction, 'hard-stop');
  assert.equal(result.reasonCode, 'policy-load-failed');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
});

test('classification failure for configured matcher event hard-stops with stable classification-failed reason', () => {
  const root = makeTempRoot();
  const policy = gate.loadPolicy({ root });
  delete policy.advisorMode.gates.toolClasses;

  const result = gate.evaluateGatePolicy(highRiskBashEvent(), { root, policy });
  assert.equal(result.gateAction, 'hard-stop');
  assert.equal(result.reasonCode, 'classification-failed');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
});

test('request artifact write failure hard-stops with stable request-write-failed reason', () => {
  const root = makeTempRoot();
  const blocker = gate.getConsultationPaths(highRiskBashEvent(), { root }).requestPath;
  fs.rmSync(path.dirname(blocker), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(path.dirname(blocker)), { recursive: true });
  fs.writeFileSync(path.dirname(blocker), 'not a directory');

  const result = gate.evaluateGatePolicy(highRiskBashEvent(), { root });
  assert.equal(result.gateAction, 'hard-stop');
  assert.equal(result.reasonCode, 'request-write-failed');
  assert.equal(result.hookOutput.hookSpecificOutput.permissionDecision, 'deny');
});

test('settings wires exactly one advisor gate PreToolUse matcher and preserves existing hooks', () => {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const preToolCommands = allHookCommands(settings, 'PreToolUse');
  const postToolCommands = allHookCommands(settings, 'PostToolUse');
  const advisorGateCommands = preToolCommands.filter(({ command }) => command.includes('advisor-gate.js'));

  assert.equal(advisorGateCommands.length, 1);
  assert.equal(advisorGateCommands[0].matcher, 'Bash|Edit|Write|MultiEdit');
  assert.doesNotMatch(advisorGateCommands[0].matcher, /Read/);
  assert.equal(preToolCommands.some(({ command }) => command.includes('advisor-boundary-check.js')), true);
  assert.equal(preToolCommands.some(({ command }) => command.includes('gsd-prompt-guard.js')), true);
  assert.equal(preToolCommands.some(({ command }) => command.includes('gsd-read-guard.js')), true);
  assert.equal(preToolCommands.some(({ command }) => command.includes('gsd-workflow-guard.js')), true);
  assert.equal(postToolCommands.some(({ command }) => command.includes('advisor-install-audit.js')), true);
  assert.equal(postToolCommands.some(({ command }) => command.includes('gsd-context-monitor.js')), true);
});
