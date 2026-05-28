#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { runtimePath } = require('../advisor-mode/runtime-paths.js');

const ALLOWED_PERMISSION_DECISIONS = new Set(['allow', 'deny', 'ask']);
const ALLOWED_DISPOSITIONS = new Set(['approve', 'reject', 'revise', 'defer']);
const REQUIRED_APPLIES_TO_EVENT = 'human_approval.required';

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function deriveCorrelationKey(event) {
  if (event && typeof event.correlationKey === 'string' && event.correlationKey) {
    return event.correlationKey;
  }

  const material = stableStringify({
    hookEventName: event && (event.hook_event_name || event.hookEventName || 'PreToolUse'),
    toolName: event && (event.tool_name || event.toolName || ''),
    toolInput: event && (event.tool_input || event.toolInput || {}),
  });
  return `runtime-probe-${crypto.createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

function buildPermissionDecisionOutput(decision, context = {}) {
  const permissionDecision = ALLOWED_PERMISSION_DECISIONS.has(decision) ? decision : 'ask';
  const hookSpecificOutput = {
    hookEventName: 'PreToolUse',
    permissionDecision,
    permissionDecisionReason: context.reason || 'Advisor Mode runtime probe decision.',
  };

  if (Object.prototype.hasOwnProperty.call(context, 'updatedInput')) {
    hookSpecificOutput.updatedInput = context.updatedInput;
  }
  if (context.additionalContext) {
    hookSpecificOutput.additionalContext = context.additionalContext;
  }

  return { hookSpecificOutput };
}

function resolveDispositionPath(event, paths = {}) {
  const root = paths.root || process.cwd();
  const dispositionsDir =
    paths.dispositionsDir || runtimePath(root, ['decisions', 'dispositions'], paths);
  const correlationKey = deriveCorrelationKey(event);

  return {
    root,
    dispositionsDir,
    correlationKey,
    dispositionPath: path.join(dispositionsDir, `${correlationKey}.json`),
  };
}

function blockedState(event, paths, reasonCode) {
  const resolved = resolveDispositionPath(event, paths);
  return {
    workflowGateStatus: 'blocked-pending-human',
    retryRequired: true,
    reentryAllowed: false,
    correlationKey: resolved.correlationKey,
    dispositionPath: resolved.dispositionPath,
    reasonCode,
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateDispositionArtifact(artifact, event, correlationKey) {
  if (!artifact || typeof artifact !== 'object') {
    return false;
  }
  if (artifact.correlationKey !== correlationKey) {
    return false;
  }
  if (!ALLOWED_DISPOSITIONS.has(artifact.disposition)) {
    return false;
  }
  if (!isNonEmptyString(artifact.decidedBy)) {
    return false;
  }
  if (!isNonEmptyString(artifact.decidedAt) || Number.isNaN(Date.parse(artifact.decidedAt))) {
    return false;
  }
  if (!isNonEmptyString(artifact.rationale)) {
    return false;
  }
  if (!artifact.appliesTo || artifact.appliesTo.event !== (event.blockedEvent || REQUIRED_APPLIES_TO_EVENT)) {
    return false;
  }
  return true;
}

function evaluateDispositionState(event, paths = {}) {
  const resolved = resolveDispositionPath(event, paths);
  let artifact;

  try {
    artifact = JSON.parse(fs.readFileSync(resolved.dispositionPath, 'utf8'));
  } catch (error) {
    return blockedState(event, paths, error.code === 'ENOENT' ? 'missing-disposition' : 'invalid-disposition-json');
  }

  if (!validateDispositionArtifact(artifact, event, resolved.correlationKey)) {
    return blockedState(event, paths, 'invalid-disposition-artifact');
  }

  return {
    workflowGateStatus: 'satisfied',
    retryRequired: true,
    reentryAllowed: true,
    correlationKey: resolved.correlationKey,
    dispositionPath: resolved.dispositionPath,
    disposition: artifact.disposition,
    decidedBy: artifact.decidedBy,
    decidedAt: artifact.decidedAt,
  };
}

function parseHookInput(input) {
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
    const event = parseHookInput(input);
    const toolName = event && (event.tool_name || event.toolName);
    if (!toolName) {
      process.exit(0);
    }

    const state = evaluateDispositionState({
      ...event,
      toolName,
      toolInput: event.tool_input || event.toolInput || {},
      hookEventName: event.hook_event_name || event.hookEventName || 'PreToolUse',
      blockedEvent: REQUIRED_APPLIES_TO_EVENT,
    });

    const decision = state.workflowGateStatus === 'satisfied' ? 'allow' : 'deny';
    const output = buildPermissionDecisionOutput(decision, {
      reason:
        state.workflowGateStatus === 'satisfied'
          ? `Valid ${state.disposition} disposition found; explicit retry may proceed.`
          : 'Human approval disposition is required before this workflow path proceeds.',
      additionalContext: JSON.stringify(state),
    });

    process.stdout.write(JSON.stringify(output));
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPermissionDecisionOutput,
  evaluateDispositionState,
  resolveDispositionPath,
  main,
};
