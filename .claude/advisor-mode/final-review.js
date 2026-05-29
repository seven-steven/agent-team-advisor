const fs = require('node:fs');
const path = require('node:path');
const { runtimePath } = require('./runtime-paths.js');
const { appendAuditEvent } = require('./audit-log.js');
const { recordAdvisorUsage } = require('./budget-state.js');

const VERDICT_SCHEMA_PATH = path.join(__dirname, 'verdict.schema.json');
const VALID_VERDICT_VALUES = {
  status: new Set(['PASS', 'CONCERNS', 'FAIL', 'BLOCKED']),
  risk: new Set(['low', 'medium', 'high', 'critical']),
  confidence: new Set(['low', 'medium', 'high']),
};
const FORBIDDEN_FIELDS = new Set(['transcript', 'full_transcript', 'raw_log']);
const ARRAY_FIELDS = [
  'changed_files',
  'relevant_diff_excerpts',
  'relevant_errors',
  'explicit_questions',
];

function readContextSchema() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'context-packet.schema.json'), 'utf8'));
}

function readVerdictSchema() {
  return JSON.parse(fs.readFileSync(VERDICT_SCHEMA_PATH, 'utf8'));
}

function copyArray(value) {
  return Array.isArray(value) ? value.map((item) => copyValue(item)) : [];
}

function copyObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)]));
}

function copyValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => copyValue(item));
  }
  if (value && typeof value === 'object') {
    return copyObject(value);
  }
  return value;
}

function buildContextPacket(input = {}) {
  const packet = {
    packet_type: 'advisor-final-review-context',
    changed_files: copyArray(input.changed_files),
    relevant_diff_excerpts: copyArray(input.relevant_diff_excerpts),
    relevant_errors: copyArray(input.relevant_errors),
    explicit_questions: copyArray(input.explicit_questions),
    created_at: input.created_at || new Date().toISOString(),
  };

  if (typeof input.correlationKey === 'string' && input.correlationKey.length > 0) {
    packet.correlationKey = input.correlationKey;
  }
  if (typeof input.task_summary === 'string') {
    packet.task_summary = input.task_summary;
  }

  const verificationSummary = copyObject(input.verification_summary);
  if (verificationSummary) {
    packet.verification_summary = verificationSummary;
  }

  return packet;
}

function validateContextPacket(packet) {
  const schema = readContextSchema();
  const errors = [];

  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { ok: false, errors: ['packet must be an object'] };
  }

  const allowedFields = new Set(Object.keys(schema.properties || {}));
  for (const key of Object.keys(packet)) {
    if (!allowedFields.has(key)) {
      errors.push(`unexpected field: ${key}`);
    }
    if (FORBIDDEN_FIELDS.has(key)) {
      errors.push(`forbidden field: ${key}`);
    }
  }

  for (const key of schema.required || []) {
    if (!Object.hasOwn(packet, key)) {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (packet.packet_type !== 'advisor-final-review-context') {
    errors.push('packet_type must be advisor-final-review-context');
  }

  for (const key of ARRAY_FIELDS) {
    if (!Array.isArray(packet[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  if (!Array.isArray(packet.explicit_questions) || packet.explicit_questions.length === 0) {
    errors.push('explicit_questions must include at least one question');
  }

  if (Array.isArray(packet.explicit_questions)) {
    packet.explicit_questions.forEach((question, index) => {
      if (typeof question !== 'string' || question.length === 0) {
        errors.push(`explicit_questions[${index}] must be a non-empty string`);
      }
    });
  }

  if (Array.isArray(packet.changed_files)) {
    packet.changed_files.forEach((file, index) => {
      if (typeof file !== 'string' || file.length === 0) {
        errors.push(`changed_files[${index}] must be a non-empty string`);
      }
    });
  }

  if (Array.isArray(packet.relevant_diff_excerpts)) {
    packet.relevant_diff_excerpts.forEach((excerpt, index) => {
      if (!excerpt || typeof excerpt !== 'object' || Array.isArray(excerpt)) {
        errors.push(`relevant_diff_excerpts[${index}] must be an object`);
        return;
      }
      const excerptFields = Object.keys(excerpt);
      for (const field of excerptFields) {
        if (!['file', 'excerpt'].includes(field)) {
          errors.push(`relevant_diff_excerpts[${index}] unexpected field: ${field}`);
        }
      }
      if (typeof excerpt.file !== 'string' || excerpt.file.length === 0) {
        errors.push(`relevant_diff_excerpts[${index}].file must be a non-empty string`);
      }
      if (typeof excerpt.excerpt !== 'string' || excerpt.excerpt.length === 0) {
        errors.push(`relevant_diff_excerpts[${index}].excerpt must be a non-empty string`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function normalizeRecommendedActions(recommendedActions) {
  if (!Array.isArray(recommendedActions)) {
    return [];
  }

  return recommendedActions.map((action, index) => {
    const generatedId = `rec-${String(index + 1).padStart(3, '0')}`;
    if (typeof action === 'string') {
      return { id: generatedId, description: action };
    }
    if (action && typeof action === 'object' && !Array.isArray(action)) {
      return {
        ...action,
        id: typeof action.id === 'string' && action.id.length > 0 ? action.id : generatedId,
      };
    }
    return { id: generatedId, description: '' };
  });
}

function validateStringArray(value, field, errors, options = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  if (options.minItems && value.length < options.minItems) {
    errors.push(`${field} must include at least ${options.minItems} item`);
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string`);
    }
  });
}

function isIsoDateTime(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function validateVerdict(verdict) {
  const schema = readVerdictSchema();
  const errors = [];

  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) {
    return { ok: false, errors: ['verdict must be an object'], direct_completion_allowed: false };
  }

  const allowedFields = new Set(Object.keys(schema.properties || {}));
  Object.keys(verdict).forEach((key) => {
    if (!allowedFields.has(key)) {
      errors.push(`unexpected field: ${key}`);
    }
  });

  (schema.required || []).forEach((field) => {
    if (!Object.hasOwn(verdict, field)) {
      errors.push(`missing required field: ${field}`);
    }
  });

  for (const [field, values] of Object.entries(VALID_VERDICT_VALUES)) {
    if (!values.has(verdict[field])) {
      errors.push(`${field} must be one of: ${Array.from(values).join(', ')}`);
    }
  }

  validateStringArray(verdict.blocking_findings, 'blocking_findings', errors);
  validateStringArray(verdict.verification_guidance, 'verification_guidance', errors);
  validateStringArray(verdict.validation_checklist, 'validation_checklist', errors, { minItems: 1 });

  const normalizedActions = normalizeRecommendedActions(verdict.recommended_actions);
  if (!Array.isArray(verdict.recommended_actions)) {
    errors.push('recommended_actions must be an array');
  }
  normalizedActions.forEach((action, index) => {
    const sourceAction = Array.isArray(verdict.recommended_actions) ? verdict.recommended_actions[index] : undefined;
    if (sourceAction && typeof sourceAction === 'object' && !Array.isArray(sourceAction)) {
      Object.keys(sourceAction).forEach((key) => {
        if (!['id', 'description'].includes(key)) {
          errors.push(`recommended_actions[${index}] unexpected field: ${key}`);
        }
      });
    }
    if (typeof action.id !== 'string' || action.id.length === 0) {
      errors.push(`recommended_actions[${index}].id must be a non-empty string`);
    }
    if (typeof action.description !== 'string' || action.description.length === 0) {
      errors.push(`recommended_actions[${index}].description must be a non-empty string`);
    }
  });

  for (const field of ['correlationKey', 'context_packet_ref', 'created_at']) {
    if (typeof verdict[field] !== 'string' || verdict[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (!isIsoDateTime(verdict.created_at)) {
    errors.push('created_at must be an ISO 8601 date-time string');
  }

  const normalizedVerdict = {
    ...verdict,
    recommended_actions: normalizedActions,
  };

  return {
    ok: errors.length === 0,
    errors,
    verdict: normalizedVerdict,
    direct_completion_allowed: errors.length === 0 && verdict.status === 'PASS',
  };
}

function validateExecutorDecision(artifact, verdict) {
  const errors = [];

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return { ok: false, errors: ['executor decision artifact must be an object'] };
  }
  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) {
    return { ok: false, errors: ['verdict must be an object'] };
  }

  const allowedFields = new Set([
    'artifact_type',
    'correlationKey',
    'taskId',
    'sessionId',
    'verdict_ref',
    'executor_decisions',
    'created_at',
  ]);
  Object.keys(artifact).forEach((key) => {
    if (!allowedFields.has(key)) errors.push(`unexpected field: ${key}`);
  });

  if (artifact.artifact_type !== 'executor-decision') {
    errors.push('artifact_type must be executor-decision');
  }
  if (typeof artifact.correlationKey !== 'string' || artifact.correlationKey.length === 0) {
    errors.push('correlationKey must be a non-empty string');
  }
  if (artifact.correlationKey !== verdict.correlationKey) {
    errors.push('correlationKey must match verdict.correlationKey');
  }
  for (const field of ['verdict_ref', 'created_at']) {
    if (typeof artifact[field] !== 'string' || artifact[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  const decisions = Array.isArray(artifact.executor_decisions) ? artifact.executor_decisions : [];
  if (!Array.isArray(artifact.executor_decisions)) {
    errors.push('executor_decisions must be an array');
  }

  const expectedIds = normalizeRecommendedActions(verdict.recommended_actions).map((action) => action.id);
  const seenIds = new Set();
  decisions.forEach((decision, index) => {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
      errors.push(`executor_decisions[${index}] must be an object`);
      return;
    }
    const decisionFields = new Set([
      'recommendation_id',
      'disposition',
      'rationale',
      'evidence_refs',
      'decided_at',
    ]);
    Object.keys(decision).forEach((key) => {
      if (!decisionFields.has(key)) errors.push(`executor_decisions[${index}] unexpected field: ${key}`);
    });
    if (typeof decision.recommendation_id !== 'string' || decision.recommendation_id.length === 0) {
      errors.push(`executor_decisions[${index}].recommendation_id must be a non-empty string`);
    } else if (seenIds.has(decision.recommendation_id)) {
      errors.push(`duplicate executor decision for recommendation ${decision.recommendation_id}`);
    } else {
      seenIds.add(decision.recommendation_id);
    }
    if (!['accepted', 'rejected', 'deferred'].includes(decision.disposition)) {
      errors.push(`executor_decisions[${index}].disposition must be accepted, rejected, or deferred`);
    }
    if (typeof decision.rationale !== 'string' || decision.rationale.length === 0) {
      errors.push(`executor_decisions[${index}].rationale must be a non-empty string`);
    }
    if (!Array.isArray(decision.evidence_refs)) {
      errors.push(`executor_decisions[${index}].evidence_refs must be an array`);
    } else {
      decision.evidence_refs.forEach((ref, refIndex) => {
        if (typeof ref !== 'string' || ref.length === 0) {
          errors.push(`executor_decisions[${index}].evidence_refs[${refIndex}] must be a non-empty string`);
        }
      });
    }
    if (typeof decision.decided_at !== 'string' || decision.decided_at.length === 0) {
      errors.push(`executor_decisions[${index}].decided_at must be a non-empty string`);
    }
  });

  expectedIds.forEach((id) => {
    if (!seenIds.has(id)) errors.push(`missing executor decision for recommendation ${id}`);
  });
  seenIds.forEach((id) => {
    if (!expectedIds.includes(id)) errors.push(`unexpected executor decision for recommendation ${id}`);
  });

  return { ok: errors.length === 0, errors };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function appendExecutorDecisionAudit(artifact, artifactPath, options = {}) {
  appendAuditEvent(
    {
      event: 'executor.final_review_decision.recorded',
      correlationKey: artifact.correlationKey,
      taskId: options.taskId || artifact.taskId,
      sessionId: options.sessionId || artifact.sessionId,
      artifactPath,
      decisionCount: artifact.executor_decisions.length,
    },
    options,
  );
}

function recordExecutorDecision(input = {}, options = {}) {
  const root = options.root || process.cwd();
  const verdict = input.verdict;
  const correlationKey = input.correlationKey || (verdict && verdict.correlationKey);
  const now = input.created_at || new Date().toISOString();
  const decisions = Array.isArray(input.decisions) ? input.decisions : [];
  const artifact = {
    artifact_type: 'executor-decision',
    correlationKey,
    taskId: input.taskId || input.task_id,
    sessionId: input.sessionId || input.session_id,
    verdict_ref: input.verdict_ref || runtimePath(options.root || process.cwd(), ['verdicts', `${correlationKey}.json`], options),
    executor_decisions: decisions.map((decision) => ({
      recommendation_id: decision.recommendation_id,
      disposition: decision.disposition,
      rationale: decision.rationale,
      evidence_refs: Array.isArray(decision.evidence_refs) ? decision.evidence_refs.slice() : [],
      decided_at: decision.decided_at || now,
    })),
    created_at: now,
  };

  const validation = validateExecutorDecision(artifact, verdict);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const artifactPath = runtimePath(root, ['decisions', 'executor', `${correlationKey}.json`], options);
  writeJson(artifactPath, artifact);
  appendExecutorDecisionAudit(artifact, artifactPath, { ...options, root });
  return { ok: true, path: artifactPath, artifact };
}

function validateVerificationEvidence(artifact) {
  const errors = [];

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return { ok: false, errors: ['verification evidence artifact must be an object'] };
  }

  const allowedFields = new Set([
    'artifact_type',
    'correlationKey',
    'taskId',
    'sessionId',
    'verdict_ref',
    'executor_decision_ref',
    'commands',
    'changed_files',
    'residual_risks',
    'created_at',
  ]);
  Object.keys(artifact).forEach((key) => {
    if (!allowedFields.has(key)) errors.push(`unexpected field: ${key}`);
  });

  if (artifact.artifact_type !== 'verification-evidence') {
    errors.push('artifact_type must be verification-evidence');
  }
  if (typeof artifact.correlationKey !== 'string' || artifact.correlationKey.length === 0) {
    errors.push('correlationKey must be a non-empty string');
  }
  for (const field of ['created_at']) {
    if (typeof artifact[field] !== 'string' || artifact[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  for (const field of ['verdict_ref', 'executor_decision_ref']) {
    if (artifact[field] !== undefined && (typeof artifact[field] !== 'string' || artifact[field].length === 0)) {
      errors.push(`${field} must be a non-empty string when present`);
    }
  }

  validateStringArray(artifact.changed_files, 'changed_files', errors);
  validateStringArray(artifact.residual_risks, 'residual_risks', errors);

  const commands = Array.isArray(artifact.commands) ? artifact.commands : [];
  if (!Array.isArray(artifact.commands)) {
    errors.push('commands must be an array');
  } else if (artifact.commands.length === 0) {
    errors.push('commands must include at least 1 item');
  }

  const allowedPurposes = new Set(['test', 'typecheck', 'lint', 'smoke', 'assertion', 'manual-check-summary']);
  commands.forEach((command, index) => {
    if (!command || typeof command !== 'object' || Array.isArray(command)) {
      errors.push(`commands[${index}] must be an object`);
      return;
    }
    const commandFields = new Set(['purpose', 'command', 'exit_status', 'summary', 'timestamp']);
    Object.keys(command).forEach((key) => {
      if (!commandFields.has(key)) errors.push(`commands[${index}] unexpected field: ${key}`);
    });
    if (!allowedPurposes.has(command.purpose)) {
      errors.push(`commands[${index}].purpose must be test, typecheck, lint, smoke, assertion, or manual-check-summary`);
    }
    for (const field of ['command', 'summary', 'timestamp']) {
      if (typeof command[field] !== 'string' || command[field].length === 0) {
        errors.push(`commands[${index}].${field} must be a non-empty string`);
      }
    }
    if (!['number', 'string'].includes(typeof command.exit_status) || command.exit_status === '') {
      errors.push(`commands[${index}].exit_status must be a number or non-empty string`);
    }
  });

  return { ok: errors.length === 0, errors };
}

function appendVerificationEvidenceAudit(artifact, artifactPath, options = {}) {
  appendAuditEvent(
    {
      event: 'verification.evidence.recorded',
      correlationKey: artifact.correlationKey,
      taskId: options.taskId || artifact.taskId,
      sessionId: options.sessionId || artifact.sessionId,
      artifactPath,
      commandCount: artifact.commands.length,
      changedFileCount: artifact.changed_files.length,
      residualRiskCount: artifact.residual_risks.length,
    },
    options,
  );
}

function recordVerificationEvidence(input = {}, options = {}) {
  const root = options.root || process.cwd();
  const correlationKey = input.correlationKey;
  const now = input.created_at || new Date().toISOString();
  const artifact = {
    artifact_type: 'verification-evidence',
    correlationKey,
    taskId: input.taskId || input.task_id,
    sessionId: input.sessionId || input.session_id,
    commands: Array.isArray(input.commands)
      ? input.commands.map((command) => ({
          purpose: command.purpose,
          command: command.command,
          exit_status: command.exit_status,
          summary: command.summary,
          timestamp: command.timestamp,
        }))
      : input.commands,
    changed_files: Array.isArray(input.changed_files) ? input.changed_files.slice() : input.changed_files,
    residual_risks: Array.isArray(input.residual_risks) ? input.residual_risks.slice() : input.residual_risks,
    created_at: now,
  };

  if (input.verdict_ref !== undefined) artifact.verdict_ref = input.verdict_ref;
  if (input.executor_decision_ref !== undefined) artifact.executor_decision_ref = input.executor_decision_ref;

  const validation = validateVerificationEvidence(artifact);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const artifactPath = runtimePath(root, ['evidence', 'verification', `${correlationKey}.json`], options);
  if (fs.existsSync(artifactPath)) {
    return { ok: false, errors: [`verification evidence already exists for correlationKey: ${correlationKey}`], path: artifactPath };
  }

  writeJson(artifactPath, artifact);
  appendVerificationEvidenceAudit(artifact, artifactPath, { ...options, root });
  return { ok: true, path: artifactPath, artifact };
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function sameStringArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function finalReviewStatePath(root, options = {}) {
  return runtimePath(root, ['state', 'final-review.json'], options);
}

function recordFinalReviewState(input = {}, options = {}) {
  const root = options.root || process.cwd();
  const state = {
    correlationKey: input.correlationKey,
    verdict_ref: input.verdict_ref,
    verification_evidence_ref: input.verification_evidence_ref,
    changed_files: Array.isArray(input.changed_files) ? input.changed_files.slice() : input.changed_files,
    changed_files_fingerprint: input.changed_files_fingerprint,
    reviewed_at: input.reviewed_at || new Date().toISOString(),
  };
  if (input.executor_decision_ref !== undefined) state.executor_decision_ref = input.executor_decision_ref;
  if (input.status !== undefined) state.status = input.status;

  const errors = [];
  for (const field of ['correlationKey', 'verdict_ref', 'verification_evidence_ref', 'changed_files_fingerprint', 'reviewed_at']) {
    if (typeof state[field] !== 'string' || state[field].length === 0) errors.push(`${field} must be a non-empty string`);
  }
  validateStringArray(state.changed_files, 'changed_files', errors);
  if (state.executor_decision_ref !== undefined && (typeof state.executor_decision_ref !== 'string' || state.executor_decision_ref.length === 0)) {
    errors.push('executor_decision_ref must be a non-empty string when present');
  }
  if (errors.length > 0) return { ok: false, errors };

  const statePath = finalReviewStatePath(root);
  writeJson(statePath, state);
  recordFinalReviewVerdictUsage({
    correlationKey: input.correlationKey,
    taskId: input.taskId,
    sessionId: input.sessionId,
    artifactPath: input.verdict_ref,
    advisorTokens: input.advisorTokens,
    advisorLatencyMs: input.advisorLatencyMs,
    usageSource: input.advisorTokens === undefined && input.advisorLatencyMs === undefined ? 'unknown' : 'metadata',
  }, { ...options, root });
  return { ok: true, path: statePath, state };
}

function isFinalReviewFresh(input = {}, options = {}) {
  const root = options.root || process.cwd();
  const state = options.state || readJson(finalReviewStatePath(root), null);
  const errors = [];

  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, fresh: false, errors: ['missing final-review state'], statePath: finalReviewStatePath(root) };
  }

  for (const field of ['correlationKey', 'verdict_ref', 'verification_evidence_ref', 'changed_files_fingerprint']) {
    if (state[field] !== input[field]) errors.push(`${field} mismatch`);
  }
  if (!sameStringArray(state.changed_files, input.changed_files)) errors.push('changed_files mismatch');
  if (typeof state.reviewed_at !== 'string' || state.reviewed_at.length === 0) errors.push('reviewed_at missing');
  if (input.executor_decision_ref !== undefined && state.executor_decision_ref !== input.executor_decision_ref) {
    errors.push('executor_decision_ref mismatch');
  }

  return {
    ok: errors.length === 0,
    fresh: errors.length === 0,
    errors,
    state,
    statePath: finalReviewStatePath(root),
  };
}

function recordFinalReviewVerdictUsage(input = {}, options = {}) {
  return recordAdvisorUsage({ ...input, eventType: 'advisor_final_review' }, options);
}

module.exports = {
  buildContextPacket,
  validateContextPacket,
  normalizeRecommendedActions,
  validateVerdict,
  recordExecutorDecision,
  validateExecutorDecision,
  recordVerificationEvidence,
  validateVerificationEvidence,
  recordFinalReviewState,
  isFinalReviewFresh,
  recordFinalReviewVerdictUsage,
};
