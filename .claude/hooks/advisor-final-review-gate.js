#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  isFinalReviewFresh,
  validateVerdict,
  validateVerificationEvidence,
  validateExecutorDecision,
} = require('../advisor-mode/final-review.js');

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readJson(filePath) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), path: filePath };
  } catch (error) {
    return { ok: false, error, path: filePath };
  }
}

function isExplicitNonTrivialCompletion(event = {}) {
  return event.taskState === 'non-trivial-completion' || event.task_state === 'non-trivial-completion' || event.requiresFinalReview === true;
}

function resolveRef(root, ref) {
  if (typeof ref !== 'string' || ref.length === 0) return null;
  return path.isAbsolute(ref) ? ref : path.join(root, ref);
}

function block(reasonCode, message, extra = {}) {
  return {
    gateAction: 'block',
    reasonCode,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        permissionDecision: 'deny',
        permissionDecisionReason: message,
        additionalContext:
          'Advisor Mode final review required: build a minimized context packet, obtain a fresh advisor final review verdict, record verification evidence, and record executor decisions for CONCERNS/FAIL/BLOCKED verdicts.',
      },
    },
    ...extra,
  };
}

function allow(reasonCode, extra = {}) {
  return {
    gateAction: 'allow',
    reasonCode,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: 'Advisor Mode final review gate satisfied for this completion state.',
      },
    },
    ...extra,
  };
}

function buildFreshnessInput(event = {}) {
  return {
    correlationKey: event.correlationKey,
    verdict_ref: event.verdict_ref,
    verification_evidence_ref: event.verification_evidence_ref,
    executor_decision_ref: event.executor_decision_ref,
    changed_files: Array.isArray(event.changed_files) ? event.changed_files.slice() : event.changed_files,
    changed_files_fingerprint: event.changed_files_fingerprint,
  };
}

function evaluateFinalReviewGate(event = {}, options = {}) {
  if (!isExplicitNonTrivialCompletion(event)) return { gateAction: 'none', reasonCode: 'not-explicit-non-trivial-completion' };

  const root = getRoot(options);
  const freshnessInput = buildFreshnessInput(event);
  const freshness = isFinalReviewFresh(freshnessInput, { root });
  if (!freshness.fresh) {
    const missingState = freshness.errors && freshness.errors.some((error) => error.includes('missing final-review state'));
    return block(
      missingState ? 'missing-fresh-final-review' : 'stale-final-review',
      'Fresh advisor final review is required before non-trivial completion.',
      { freshness },
    );
  }

  const verdictRead = readJson(resolveRef(root, event.verdict_ref));
  if (!verdictRead.ok) return block('missing-final-verdict', 'Final advisor verdict artifact is missing or unreadable.', { freshness });
  const verdictValidation = validateVerdict(verdictRead.value);
  if (!verdictValidation.ok) return block('invalid-final-verdict', 'Final advisor verdict artifact is invalid.', { freshness, verdictValidation });
  const verdict = verdictValidation.verdict;
  if (verdict.correlationKey !== event.correlationKey) {
    return block('verdict-correlation-mismatch', 'Final advisor verdict correlation key does not match completion event.', { freshness });
  }

  const evidenceRead = readJson(resolveRef(root, event.verification_evidence_ref));
  if (!evidenceRead.ok) return block('missing-verification-evidence', 'Verification evidence artifact is missing or unreadable.', { freshness });
  const evidenceValidation = validateVerificationEvidence(evidenceRead.value);
  if (!evidenceValidation.ok) return block('invalid-verification-evidence', 'Verification evidence artifact is invalid.', { freshness, evidenceValidation });
  if (evidenceRead.value.correlationKey !== event.correlationKey || evidenceRead.value.verdict_ref !== event.verdict_ref) {
    return block('verification-evidence-mismatch', 'Verification evidence must match final verdict and correlation key.', { freshness });
  }

  if (verdict.status === 'PASS') return allow('fresh-pass-final-review', { freshness });

  if (typeof event.executor_decision_ref !== 'string' || event.executor_decision_ref.length === 0) {
    return block('missing-executor-decision-ref', 'Non-PASS final verdict requires an executor-decision artifact reference.', { freshness });
  }
  const decisionRead = readJson(resolveRef(root, event.executor_decision_ref));
  if (!decisionRead.ok) return block('missing-executor-decision', 'Non-PASS final verdict requires a matching executor-decision artifact.', { freshness });
  const decisionValidation = validateExecutorDecision(decisionRead.value, verdict);
  if (!decisionValidation.ok || decisionRead.value.verdict_ref !== event.verdict_ref) {
    return block('invalid-executor-decision', 'Executor-decision artifact must validate against the non-PASS final verdict.', {
      freshness,
      decisionValidation,
    });
  }

  return allow('fresh-non-pass-final-review-with-executor-decision', { freshness });
}

function parseInput(input) {
  try {
    return input ? JSON.parse(input) : null;
  } catch {
    return null;
  }
}

function main() {
  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    const event = parseInput(input);
    if (!event) process.exit(0);
    const result = evaluateFinalReviewGate(event);
    if (result.hookOutput) process.stdout.write(JSON.stringify(result.hookOutput));
    if (result.gateAction === 'block') process.exitCode = 2;
  });
}

if (require.main === module) main();

module.exports = { evaluateFinalReviewGate, main };
