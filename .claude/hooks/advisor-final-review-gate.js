#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  isFinalReviewFresh,
  validateVerdict,
  validateVerificationEvidence,
  validateExecutorDecision,
} = require('../advisor-mode/final-review.js');
const { runtimePath } = require('../advisor-mode/runtime-paths.js');

function readAdvisorHookConfig(rootDir) {
  try {
    const configPath = path.join(rootDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.hooks || {};
  } catch {
    return {};
  }
}

function isAdvisorModeEnabled(rootDir) {
  return readAdvisorHookConfig(rootDir).advisor_mode === true;
}

function isAdvisorModeStrict(rootDir) {
  return readAdvisorHookConfig(rootDir).advisor_mode_strict === true;
}

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
  if (path.isAbsolute(ref)) return ref;
  if (ref.startsWith('.advisor/')) return runtimePath(root, ref.slice('.advisor/'.length).split('/'));
  return path.join(root, ref);
}

function advisoryOnly(reasonCode, message, extra = {}) {
  return {
    gateAction: 'advisory',
    advisoryOnly: true,
    reasonCode,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: message,
      },
    },
    ...extra,
  };
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
  const root = getRoot(options);
  if (!isAdvisorModeEnabled(root)) return { gateAction: 'none', reasonCode: 'advisor-mode-disabled' };
  const strictMode = isAdvisorModeStrict(root);
  if (!isExplicitNonTrivialCompletion(event)) return { gateAction: 'none', reasonCode: 'not-explicit-non-trivial-completion' };

  const freshnessInput = buildFreshnessInput(event);
  const freshness = isFinalReviewFresh(freshnessInput, { root });
  if (!freshness.fresh) {
    const missingState = freshness.errors && freshness.errors.some((error) => error.includes('missing final-review state'));
    return strictMode
      ? block(
          missingState ? 'missing-fresh-final-review' : 'stale-final-review',
          'Fresh advisor final review is required before non-trivial completion.',
          { freshness },
        )
      : advisoryOnly(
          missingState ? 'missing-fresh-final-review' : 'stale-final-review',
          'Fresh advisor final review is recommended before non-trivial completion.',
          { freshness },
        );
  }

  const verdictRead = readJson(resolveRef(root, event.verdict_ref));
  if (!verdictRead.ok) return strictMode ? block('missing-final-verdict', 'Final advisor verdict artifact is missing or unreadable.', { freshness }) : advisoryOnly('missing-final-verdict', 'Final advisor verdict artifact is recommended before completion.', { freshness });
  const verdictValidation = validateVerdict(verdictRead.value);
  if (!verdictValidation.ok) {
    return strictMode
      ? block('invalid-final-verdict', 'Final advisor verdict artifact is invalid.', { freshness, verdictValidation })
      : advisoryOnly('invalid-final-verdict', 'Final advisor verdict artifact should be repaired before completion.', { freshness, verdictValidation });
  }
  const verdict = verdictValidation.verdict;
  if (verdict.correlationKey !== event.correlationKey) {
    return strictMode
      ? block('verdict-correlation-mismatch', 'Final advisor verdict correlation key does not match completion event.', { freshness })
      : advisoryOnly('verdict-correlation-mismatch', 'Final advisor verdict correlation should be corrected before completion.', { freshness });
  }

  const evidenceRead = readJson(resolveRef(root, event.verification_evidence_ref));
  if (!evidenceRead.ok) return strictMode ? block('missing-verification-evidence', 'Verification evidence artifact is missing or unreadable.', { freshness }) : advisoryOnly('missing-verification-evidence', 'Verification evidence is recommended before completion.', { freshness });
  const evidenceValidation = validateVerificationEvidence(evidenceRead.value);
  if (!evidenceValidation.ok) {
    return strictMode
      ? block('invalid-verification-evidence', 'Verification evidence artifact is invalid.', { freshness, evidenceValidation })
      : advisoryOnly('invalid-verification-evidence', 'Verification evidence should be repaired before completion.', { freshness, evidenceValidation });
  }
  if (evidenceRead.value.correlationKey !== event.correlationKey || evidenceRead.value.verdict_ref !== event.verdict_ref) {
    return strictMode
      ? block('verification-evidence-mismatch', 'Verification evidence must match final verdict and correlation key.', { freshness })
      : advisoryOnly('verification-evidence-mismatch', 'Verification evidence should match the final verdict before completion.', { freshness });
  }

  if (verdict.status === 'PASS') return allow('fresh-pass-final-review', { freshness });

  if (typeof event.executor_decision_ref !== 'string' || event.executor_decision_ref.length === 0) {
    return strictMode
      ? block('missing-executor-decision-ref', 'Non-PASS final verdict requires an executor-decision artifact reference.', { freshness })
      : advisoryOnly('missing-executor-decision-ref', 'Executor decision evidence is recommended before completion.', { freshness });
  }
  const decisionRead = readJson(resolveRef(root, event.executor_decision_ref));
  if (!decisionRead.ok) return strictMode ? block('missing-executor-decision', 'Non-PASS final verdict requires a matching executor-decision artifact.', { freshness }) : advisoryOnly('missing-executor-decision', 'Executor decision artifact is recommended before completion.', { freshness });
  const decisionValidation = validateExecutorDecision(decisionRead.value, verdict);
  if (!decisionValidation.ok || decisionRead.value.verdict_ref !== event.verdict_ref) {
    return strictMode
      ? block('invalid-executor-decision', 'Executor-decision artifact must validate against the non-PASS final verdict.', {
          freshness,
          decisionValidation,
        })
      : advisoryOnly('invalid-executor-decision', 'Executor-decision artifact should validate against the final verdict before completion.', {
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

function writeBlockingStopResponse(reasonCode, message) {
  process.stdout.write(JSON.stringify(block(reasonCode, message).hookOutput));
}

function blockInvalidStopInput(reasonCode, message) {
  writeBlockingStopResponse(reasonCode, message);
  process.exitCode = 2;
}

function main() {
  let input = '';
  const timeoutMs = Number.parseInt(process.env.ADVISOR_FINAL_REVIEW_GATE_STDIN_TIMEOUT_MS || '3000', 10);
  const stdinTimeout = setTimeout(() => {
    blockInvalidStopInput('invalid-stop-hook-input', 'Fresh advisor final review is required before completion because Stop hook input was unavailable.');
    process.exit(2);
  }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    const event = parseInput(input);
    if (!event) {
      blockInvalidStopInput('invalid-stop-hook-input', 'Fresh advisor final review is required before completion because Stop hook input was empty or malformed.');
      return;
    }
    const result = evaluateFinalReviewGate(event);
    if (result.hookOutput) process.stdout.write(JSON.stringify(result.hookOutput));
    if (result.gateAction === 'block') process.exitCode = 2;
  });
}

if (require.main === module) main();

module.exports = { evaluateFinalReviewGate, main };
