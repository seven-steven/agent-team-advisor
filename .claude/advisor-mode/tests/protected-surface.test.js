const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runtimePath } = require('../runtime-paths.js');
const {
  classifyPathClass,
  evaluateGatePolicy,
  buildDecisionPacket,
  evaluateHumanGateReentry,
  writeDisposition,
} = require('../../hooks/advisor-gate.js');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude/advisor-mode/policy.example.json'), 'utf8'));

function makeTempRoot(hooks = { advisor_mode: true, advisor_mode_strict: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-mode-protected-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.planning', 'config.json'),
    JSON.stringify({ hooks }, null, 2) + '\n',
  );
  return root;
}

function writeRecommendation(recommendationPath, request) {
  fs.mkdirSync(path.dirname(recommendationPath), { recursive: true });
  fs.writeFileSync(
    recommendationPath,
    JSON.stringify(
      {
        correlationKey: request.correlationKey,
        source: 'read-only-advisor',
        advisorAgent: 'advisor-reviewer',
        status: 'CONCERNS',
        risk: request.risk,
        confidence: 'high',
        recommendation: 'Review protected Advisor Mode surface before proceeding.',
        rationale: 'Protected governance surfaces affect advisor enforcement behavior.',
        blockingFindings: [],
        recommendedActions: ['Inspect the protected surface change.'],
        verificationGuidance: ['Run node --test .claude/advisor-mode/tests/*.test.js'],
        requestPath: request.requestPath,
      },
      null,
      2,
    ) + '\n',
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('policy classifies every D-14 protected surface from policy data', () => {
  const cases = [
    ['.claude/advisor-mode/policy.example.json', 'advisor-policy'],
    ['.claude/advisor-mode/verdict.schema.json', 'advisor-policy'],
    ['.claude/hooks/advisor-gate.js', 'advisor-hooks'],
    ['.claude/settings.json', 'claude-settings'],
    ['.claude/agents/advisor-reviewer.md', 'advisor-agents'],
    ['.claude/commands/advisor-mode.md', 'advisor-commands'],
    ['.claude/advisor-mode/provider-routes.example.json', 'provider-routes'],
    ['.claude/advisor-mode/credentials.example.json', 'credential-controls'],
  ];

  for (const [filePath, expectedClass] of cases) {
    assert.equal(classifyPathClass('Edit', { file_path: filePath }, policy), expectedClass, filePath);
  }
});

test('protected surface matching is path-class-first and policy-driven', () => {
  const protectedSurfaces = policy.advisorMode.gates.protectedSurfaces;
  assert.ok(protectedSurfaces, 'protected surfaces should be declared in policy data');
  assert.equal(protectedSurfaces.auditLabel, 'protected-surface.review');
  assert.deepEqual(protectedSurfaces.exceptions, ['.claude/advisor-mode/README.md']);

  assert.equal(classifyPathClass('Edit', { file_path: '.claude/advisor-mode/README.md' }, policy), 'ordinary');
  assert.equal(classifyPathClass('Edit', { file_path: '.claude/advisor-mode/nested/rule.json' }, policy), 'advisor-policy');
  assert.equal(classifyPathClass('Edit', { file_path: 'src/index.js' }, policy), 'ordinary');
});

test('default protected changes use advisor producer chain and block first attempt', () => {
  const root = makeTempRoot();
  const result = evaluateGatePolicy(
    { toolName: 'Edit', toolInput: { file_path: '.claude/advisor-mode/policy.example.json' } },
    { root, policy },
  );

  assert.equal(result.gateAction, 'block');
  assert.equal(result.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(result.retryRequired, true);
  assert.equal(result.reentryAllowed, false);
  assert.equal(result.policyRuleId, 'protected-surface-review');
  assert.equal(result.auditLabel, 'protected-surface.review');
  assert.match(result.hookOutput.hookSpecificOutput.permissionDecisionReason, /Advisor consultation is required/);

  const request = readJson(result.requestPath);
  assert.equal(request.event, 'advisor_consultation.required');
  assert.equal(request.auditLabel, 'protected-surface.review');
  assert.equal(request.policyRuleId, 'protected-surface-review');
  assert.equal(request.pathClass, 'advisor-policy');
  assert.equal(request.advisorProducer.agent, 'advisor-reviewer');
  assert.equal(request.advisorProducer.outputPath, result.recommendationPath);
});

test('critical protected changes require advisor recommendation before human packet', () => {
  const root = makeTempRoot();
  const first = evaluateGatePolicy(
    {
      toolName: 'Edit',
      toolInput: { file_path: '.claude/hooks/advisor-gate.js' },
      taskState: 'governance-configuration',
    },
    { root, policy },
  );

  assert.equal(first.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(first.policyRuleId, 'protected-surface-human-approval');
  assert.equal(first.auditLabel, 'protected-surface.review');

  writeRecommendation(first.recommendationPath, readJson(first.requestPath));

  const packet = evaluateGatePolicy(
    {
      toolName: 'Edit',
      toolInput: { file_path: '.claude/hooks/advisor-gate.js' },
      taskState: 'governance-configuration',
    },
    { root, policy },
  );

  assert.equal(packet.event, 'human_approval.required');
  assert.equal(packet.workflowGateStatus, 'blocked-pending-human');
  assert.equal(packet.retryRequired, true);
  assert.equal(packet.reentryAllowed, false);
  assert.equal(packet.requiresExplicitRetry, true);
  assert.equal(packet.auditLabel, 'protected-surface.review');
  assert.equal(packet.advisorRecommendation.correlationKey, first.correlationKey);
  assert.match(packet.dispositionPath, /advisor-mode.*decisions[\\/]dispositions[\\/]advisor-consultation-/);
});

test('evaluateGatePolicy unlocks protected human approval retry after disposition', () => {
  const root = makeTempRoot();
  const event = {
    toolName: 'Edit',
    toolInput: { file_path: '.claude/hooks/advisor-gate.js' },
    taskState: 'governance-configuration',
  };
  const first = evaluateGatePolicy(event, { root, policy });
  assert.equal(first.workflowGateStatus, 'blocked-pending-advisor');
  assert.equal(first.policyRuleId, 'protected-surface-human-approval');
  writeRecommendation(first.recommendationPath, readJson(first.requestPath));

  const packet = evaluateGatePolicy(event, { root, policy });
  assert.equal(packet.event, 'human_approval.required');
  assert.equal(packet.workflowGateStatus, 'blocked-pending-human');

  writeDisposition(
    {
      correlationKey: packet.correlationKey,
      disposition: 'approve',
      decidedBy: 'human-operator',
      rationale: 'Approved protected surface retry.',
      appliesTo: { event: packet.event },
    },
    { root },
  );
  const retry = evaluateGatePolicy(event, { root, policy });
  assert.equal(retry.gateAction, 'allow');
  assert.equal(retry.workflowGateStatus, 'satisfied');
  assert.equal(retry.reentryAllowed, true);
  assert.equal(retry.disposition, 'approve');
  assert.equal(retry.auditLabel, 'protected-surface.review');
});

test('critical protected re-entry requires matching approve reject revise or defer disposition', () => {
  const root = makeTempRoot();
  const blocked = buildDecisionPacket(
    {
      correlationKey: 'advisor-consultation-protected-human',
      decisionClass: 'security-boundary',
      pathClass: 'advisor-hooks',
      risk: 'critical',
      policyRuleId: 'protected-surface-human-approval',
      triggerReason: 'Protected hook change requires human disposition.',
    },
    { root },
  );
  assert.equal(blocked.workflowGateStatus, 'blocked-pending-advisor');
  writeRecommendation(blocked.recommendationPath, blocked);

  const packet = buildDecisionPacket(
    {
      correlationKey: 'advisor-consultation-protected-human',
      decisionClass: 'security-boundary',
      pathClass: 'advisor-hooks',
      risk: 'critical',
      policyRuleId: 'protected-surface-human-approval',
      triggerReason: 'Protected hook change requires human disposition.',
    },
    { root },
  );

  assert.equal(evaluateHumanGateReentry(packet, { root }).workflowGateStatus, 'blocked-pending-human');

  for (const disposition of ['approve', 'reject', 'revise', 'defer']) {
    const dispositionPath = runtimePath(root, ['decisions', 'dispositions', `${packet.correlationKey}-${disposition}.json`]);
    const packetForDisposition = { ...packet, dispositionPath };
    writeDisposition(
      {
        correlationKey: packet.correlationKey,
        disposition,
        decidedBy: 'human-operator',
        rationale: `${disposition} protected surface change`,
        appliesTo: { event: packet.event },
      },
      { root, dispositionPath },
    );
    const reentry = evaluateHumanGateReentry(packetForDisposition, { root, dispositionPath });
    assert.equal(reentry.workflowGateStatus, 'satisfied');
    assert.equal(reentry.reentryAllowed, true);
    assert.equal(reentry.retryRequired, true);
    assert.equal(reentry.disposition, disposition);
  }
});

test('ordinary source and docs edits do not escalate solely because they mutate files', () => {
  const root = makeTempRoot();
  for (const filePath of ['src/index.js', 'docs/usage.md', '.claude/advisor-mode/README.md']) {
    const result = evaluateGatePolicy({ toolName: 'Edit', toolInput: { file_path: filePath } }, { root, policy });
    assert.equal(result.gateAction, 'none', filePath);
  }
});

test('README documents protected surface operational chain', () => {
  const readme = fs.readFileSync(path.join(repoRoot, '.claude/advisor-mode/README.md'), 'utf8');
  assert.match(readme, /host permissions/i);
  assert.match(readme, /workflow gates/i);
  assert.match(readme, /read-only `advisor-reviewer`/);
  assert.match(readme, /persists `.advisor\/consultations\/recommendations\/\{correlationKey\}\.json`/);
  assert.match(readme, /threshold 2/);
  assert.match(readme, /`.advisor\/decisions\/dispositions\/\{correlationKey\}\.json`/);
  assert.match(readme, /Missing disposition keeps the workflow path blocked locally/);
  assert.match(readme, /explicit retry/);
  assert.match(readme, /path-class-first/);
  assert.match(readme, /protected-surface\.review/);
  assert.match(readme, /node --test \.claude\/advisor-mode\/tests\/\*\.test\.js/);
});
