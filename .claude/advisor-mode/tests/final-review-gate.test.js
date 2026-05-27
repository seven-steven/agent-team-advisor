const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const advisorModeRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(advisorModeRoot, '..', '..');
const finalReview = require('../final-review.js');
const finalReviewGatePath = path.join(projectRoot, '.claude', 'hooks', 'advisor-final-review-gate.js');
const { evaluateFinalReviewGate } = require(finalReviewGatePath);

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-final-review-gate-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeEvent(overrides = {}) {
  return {
    hookEventName: 'Stop',
    taskState: 'non-trivial-completion',
    correlationKey: 'final-review-03-05',
    verdict_ref: '.advisor/verdicts/final-review-03-05.json',
    verification_evidence_ref: '.advisor/evidence/verification/final-review-03-05.json',
    changed_files: [
      '.claude/advisor-mode/final-review.js',
      '.claude/hooks/advisor-final-review-gate.js',
    ],
    changed_files_fingerprint: 'fingerprint-current',
    ...overrides,
  };
}

function makeVerdict(overrides = {}) {
  return {
    status: 'PASS',
    risk: 'low',
    confidence: 'high',
    blocking_findings: [],
    recommended_actions: [
      { id: 'rec-run-tests', description: 'Run final review gate tests.' },
    ],
    verification_guidance: ['node --test .claude/advisor-mode/tests/final-review-gate.test.js'],
    validation_checklist: ['Final review gate tests pass.'],
    correlationKey: 'final-review-03-05',
    context_packet_ref: '.advisor/context/final-review-03-05.json',
    created_at: '2026-05-27T07:05:00.000Z',
    ...overrides,
  };
}

function makeEvidence(overrides = {}) {
  return {
    artifact_type: 'verification-evidence',
    correlationKey: 'final-review-03-05',
    verdict_ref: '.advisor/verdicts/final-review-03-05.json',
    commands: [
      {
        purpose: 'test',
        command: 'node --test .claude/advisor-mode/tests/final-review-gate.test.js',
        exit_status: 0,
        summary: 'final review gate tests passed',
        timestamp: '2026-05-27T07:06:00.000Z',
      },
    ],
    changed_files: [
      '.claude/advisor-mode/final-review.js',
      '.claude/hooks/advisor-final-review-gate.js',
    ],
    residual_risks: [],
    created_at: '2026-05-27T07:06:00.000Z',
    ...overrides,
  };
}

function makeExecutorDecision() {
  return {
    artifact_type: 'executor-decision',
    correlationKey: 'final-review-03-05',
    verdict_ref: '.advisor/verdicts/final-review-03-05.json',
    executor_decisions: [
      {
        recommendation_id: 'rec-run-tests',
        disposition: 'accepted',
        rationale: 'The final-review gate test is decisive for this slice.',
        evidence_refs: ['.advisor/evidence/verification/final-review-03-05.json#commands.0'],
        decided_at: '2026-05-27T07:07:00.000Z',
      },
    ],
    created_at: '2026-05-27T07:07:00.000Z',
  };
}

function stopHookCommands(settings) {
  return (settings.hooks.Stop || []).flatMap((entry) =>
    (entry.hooks || []).map((hook) => hook.command),
  );
}

function allHookCommands(settings) {
  return Object.values(settings.hooks || {}).flatMap((entries) =>
    entries.flatMap((entry) => (entry.hooks || []).map((hook) => hook.command)),
  );
}

function writeFinalReviewArtifacts(root, { verdict = makeVerdict(), evidence = makeEvidence(), executorDecision, state } = {}) {
  writeJson(path.join(root, '.advisor', 'verdicts', 'final-review-03-05.json'), verdict);
  writeJson(path.join(root, '.advisor', 'evidence', 'verification', 'final-review-03-05.json'), evidence);
  if (executorDecision) {
    writeJson(path.join(root, '.advisor', 'decisions', 'executor', 'final-review-03-05.json'), executorDecision);
  }
  if (state) {
    writeJson(path.join(root, '.advisor', 'state', 'final-review.json'), state);
  }
}

function runFinalReviewGate(input, options = {}) {
  return spawnSync(process.execPath, [finalReviewGatePath], {
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      ADVISOR_FINAL_REVIEW_GATE_STDIN_TIMEOUT_MS: String(options.stdinTimeoutMs || 100),
    },
    timeout: options.processTimeoutMs || 1000,
  });
}

function assertBlockingHookOutput(result) {
  assert.notEqual(result.status, 0);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.match(output, /fresh advisor final review/i);
  assert.match(output, /deny|block|required/i);
}

test('Stop hook CLI fails closed on empty stdin', () => {
  assertBlockingHookOutput(runFinalReviewGate(''));
});

test('Stop hook CLI fails closed on malformed stdin', () => {
  assertBlockingHookOutput(runFinalReviewGate('{not-json'));
});

test('Stop hook CLI fails closed when stdin does not end before timeout', async () => {
  const child = spawn(process.execPath, [finalReviewGatePath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ADVISOR_FINAL_REVIEW_GATE_STDIN_TIMEOUT_MS: '50',
    },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.stdin.write('{');

  const status = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
  });

  assertBlockingHookOutput({ status, stdout, stderr });
});

test('explicit non-trivial completion blocks when no fresh final review exists', () => {
  assert.equal(typeof evaluateFinalReviewGate, 'function');
  const root = makeTempRepo();
  writeJson(path.join(root, '.advisor', 'consultations', 'recommendations', 'final-review-03-05.json'), {
    correlationKey: 'final-review-03-05',
    status: 'PASS',
  });

  const result = evaluateFinalReviewGate(makeEvent(), { root });

  assert.equal(result.gateAction, 'block');
  assert.equal(result.hookOutput.hookSpecificOutput.hookEventName, 'Stop');
  assert.match(result.reasonCode, /missing|fresh|state/);
  assert.match(result.hookOutput.hookSpecificOutput.additionalContext, /fresh advisor final review/i);
});

test('stale final review blocks on evidence ref and changed-file fingerprint mismatch', () => {
  const root = makeTempRepo();
  writeFinalReviewArtifacts(root, {
    state: {
      correlationKey: 'final-review-03-05',
      verdict_ref: '.advisor/verdicts/final-review-03-05.json',
      verification_evidence_ref: '.advisor/evidence/verification/old.json',
      changed_files: ['.claude/advisor-mode/final-review.js'],
      changed_files_fingerprint: 'fingerprint-old',
      status: 'PASS',
      reviewed_at: '2026-05-27T07:08:00.000Z',
    },
  });

  const result = evaluateFinalReviewGate(makeEvent(), { root });

  assert.equal(result.gateAction, 'block');
  assert.equal(result.reasonCode, 'stale-final-review');
  assert.equal(result.freshness.errors.some((error) => error.includes('verification_evidence_ref')), true);
  assert.equal(result.freshness.errors.some((error) => error.includes('changed_files_fingerprint')), true);
});

test('PASS verdict with matching verification evidence and changed-file fingerprint allows completion', () => {
  assert.equal(typeof finalReview.recordFinalReviewState, 'function');
  assert.equal(typeof finalReview.isFinalReviewFresh, 'function');
  const root = makeTempRepo();
  writeFinalReviewArtifacts(root);
  const recorded = finalReview.recordFinalReviewState(
    {
      correlationKey: 'final-review-03-05',
      verdict_ref: '.advisor/verdicts/final-review-03-05.json',
      verification_evidence_ref: '.advisor/evidence/verification/final-review-03-05.json',
      changed_files: makeEvent().changed_files,
      changed_files_fingerprint: 'fingerprint-current',
      reviewed_at: '2026-05-27T07:08:00.000Z',
    },
    { root },
  );
  assert.equal(recorded.ok, true);

  const result = evaluateFinalReviewGate(makeEvent(), { root });

  assert.equal(result.gateAction, 'allow');
  assert.equal(result.reasonCode, 'fresh-pass-final-review');
});

test('non-PASS final verdict blocks until matching executor-decision artifact exists', () => {
  const root = makeTempRepo();
  writeFinalReviewArtifacts(root, {
    verdict: makeVerdict({ status: 'CONCERNS', risk: 'medium' }),
    state: {
      correlationKey: 'final-review-03-05',
      verdict_ref: '.advisor/verdicts/final-review-03-05.json',
      verification_evidence_ref: '.advisor/evidence/verification/final-review-03-05.json',
      executor_decision_ref: '.advisor/decisions/executor/final-review-03-05.json',
      changed_files: makeEvent().changed_files,
      changed_files_fingerprint: 'fingerprint-current',
      status: 'CONCERNS',
      reviewed_at: '2026-05-27T07:08:00.000Z',
    },
  });

  const missingDecision = evaluateFinalReviewGate(
    makeEvent({ executor_decision_ref: '.advisor/decisions/executor/final-review-03-05.json' }),
    { root },
  );
  assert.equal(missingDecision.gateAction, 'block');
  assert.equal(missingDecision.reasonCode, 'missing-executor-decision');

  writeJson(path.join(root, '.advisor', 'decisions', 'executor', 'final-review-03-05.json'), makeExecutorDecision());
  const satisfied = evaluateFinalReviewGate(
    makeEvent({ executor_decision_ref: '.advisor/decisions/executor/final-review-03-05.json' }),
    { root },
  );

  assert.equal(satisfied.gateAction, 'allow');
  assert.equal(satisfied.reasonCode, 'fresh-non-pass-final-review-with-executor-decision');
});

test('settings wire exactly one Stop hook for final review gate while preserving existing advisor hooks', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8'));
  const stopCommands = stopHookCommands(settings).filter((command) => command.includes('advisor-final-review-gate.js'));
  const allCommands = allHookCommands(settings);

  assert.equal(stopCommands.length, 1);
  assert.match(stopCommands[0], /\.claude\/hooks\/advisor-final-review-gate\.js/);
  assert.equal(allCommands.some((command) => command.includes('advisor-gate.js')), true);
  assert.equal(allCommands.some((command) => command.includes('advisor-boundary-check.js')), true);
  assert.equal(allCommands.some((command) => command.includes('advisor-failure-tracker.js')), true);
});
