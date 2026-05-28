#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { runtimePath } = require('../advisor-mode/runtime-paths.js');

const FAILURE_THRESHOLD = 2;
const DEFAULT_STATE_FILE = ['state', 'failure-signatures.json'];
const DEFAULT_AUDIT_FILE = ['audit', 'events.jsonl'];

function isAdvisorModeEnabled(rootDir) {
  try {
    const configPath = path.join(rootDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.hooks?.advisor_mode === true;
  } catch {
    return false;
  }
}

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function getToolResponse(payload = {}) {
  return pick(payload.toolResponse, payload.tool_response, {});
}

function getExitCode(payload = {}) {
  const response = getToolResponse(payload);
  return pick(payload.exitCode, payload.exit_code, response.exitCode, response.exit_code, payload.status, response.status, 'unknown');
}

function getOutputText(payload = {}) {
  const response = getToolResponse(payload);
  return [
    pick(payload.stderr, response.stderr, ''),
    pick(payload.stdout, response.stdout, ''),
    pick(payload.error, response.error, ''),
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeVolatileText(text) {
  return String(text || '')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<timestamp>')
    .replace(/\b[0-9a-f]{32,64}\b/gi, '<hash>')
    .replace(/\b(?:id|pid|uuid|requestId|request_id)[:= ]+[A-Za-z0-9._-]+\b/gi, '<id>')
    .replace(/\b\d{4,}\b/g, '<number>')
    .replace(/(?:[A-Za-z]:)?(?:\/[^\s:]+)+(?::\d+){0,2}/g, '<path>')
    .replace(/\b(?:tmp|temp|advisor|fixture|node-test)-[A-Za-z0-9._-]+\b/gi, '<temp>')
    .replace(/:\d+:\d+\b/g, ':<line>:<column>')
    .replace(/\s+/g, ' ')
    .trim();
}

function getErrorClass(text) {
  const match = String(text || '').match(/\b([A-Za-z][A-Za-z0-9_]*(?:Error|Exception)|ENOENT|EACCES|EPERM|ECONNREFUSED|ETIMEDOUT)\b/);
  return match ? match[1] : 'unknown-error';
}

function normalizeFailureSignature(payload = {}) {
  const toolName = pick(payload.toolName, payload.tool_name, 'unknown-tool');
  const exitCode = String(getExitCode(payload));
  const command = String((payload.toolInput || payload.tool_input || {}).command || '');
  const actionClass = pick(payload.actionClass, payload.action_class, command ? 'command' : 'unknown-action');
  const text = getOutputText(payload);
  const normalizedText = normalizeVolatileText(text);
  const errorClass = getErrorClass(text);
  return `tool:${toolName}|exit:${exitCode}|action:${actionClass}|error:${errorClass}|text:${normalizedText}`;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function updateFailureState(payload = {}, options = {}) {
  const root = getRoot(options);
  const statePath = options.statePath || runtimePath(root, DEFAULT_STATE_FILE, options);
  const signature = options.signature || normalizeFailureSignature(payload);
  const state = readJson(statePath, { version: 1, signatures: {} });
  if (!state.signatures || typeof state.signatures !== 'object') state.signatures = {};
  const current = state.signatures[signature] || { count: 0 };
  const count = Number(current.count || 0) + 1;
  const now = new Date().toISOString();
  state.signatures[signature] = {
    signature,
    count,
    firstSeenAt: current.firstSeenAt || now,
    lastSeenAt: now,
    toolName: pick(payload.toolName, payload.tool_name, current.toolName, 'unknown-tool'),
    exitCode: String(getExitCode(payload)),
  };
  writeJson(statePath, state);
  return { state, statePath, signature, count, record: state.signatures[signature] };
}

function buildFailureEvent(payload = {}, stateUpdate = {}, options = {}) {
  const root = getRoot(options);
  const correlationSeed = `${stateUpdate.signature || normalizeFailureSignature(payload)}|${stateUpdate.count || 0}`;
  const correlationKey = `advisor-consultation-${crypto.createHash('sha256').update(correlationSeed).digest('hex').slice(0, 24)}`;
  const requiresAdvisorConsultation = Number(stateUpdate.count || 0) >= FAILURE_THRESHOLD;
  const event = {
    correlationKey,
    event: requiresAdvisorConsultation ? 'advisor_consultation.required' : 'advisor_failure.observed',
    triggerReason: requiresAdvisorConsultation
      ? 'Repeated failure threshold reached; read-only advisor consultation required.'
      : 'Tool failure observed below advisor consultation threshold.',
    signature: stateUpdate.signature || normalizeFailureSignature(payload),
    count: Number(stateUpdate.count || 0),
    threshold: FAILURE_THRESHOLD,
    toolName: pick(payload.toolName, payload.tool_name, 'unknown-tool'),
    exitCode: String(getExitCode(payload)),
    requiresAdvisorConsultation,
    requiresAdvisorDisposition: requiresAdvisorConsultation,
    workflowGateStatus: requiresAdvisorConsultation ? 'blocked-pending-advisor' : 'observed',
    retryRequired: requiresAdvisorConsultation,
    statePath: stateUpdate.statePath || runtimePath(root, DEFAULT_STATE_FILE, options),
    auditPath: options.auditPath || runtimePath(root, DEFAULT_AUDIT_FILE, options),
  };
  return event;
}

function appendAuditEvent(event, options = {}) {
  const root = getRoot(options);
  const auditPath = options.auditPath || event.auditPath || runtimePath(root, DEFAULT_AUDIT_FILE, options);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  const concise = {
    timestamp: new Date().toISOString(),
    event: event.event,
    correlationKey: event.correlationKey,
    signature: event.signature,
    count: event.count,
    threshold: event.threshold,
    toolName: event.toolName,
    exitCode: event.exitCode,
    requiresAdvisorConsultation: event.requiresAdvisorConsultation,
    requiresAdvisorDisposition: event.requiresAdvisorDisposition,
  };
  fs.appendFileSync(auditPath, `${JSON.stringify(concise)}\n`);
}

function isFailure(payload = {}) {
  const exitCode = getExitCode(payload);
  const status = String(pick(payload.status, getToolResponse(payload).status, '')).toLowerCase();
  const normalizedExitCode = Number.parseInt(String(exitCode), 10);
  const hasNumericFailureExit = Number.isFinite(normalizedExitCode) && normalizedExitCode !== 0;
  return hasNumericFailureExit || ['failed', 'failure', 'error'].includes(status);
}

function trackFailure(payload = {}, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { event: 'advisor_failure_tracker.fail_open', failOpen: true, reasonCode: 'malformed-host-payload' };
  }
  if (!isFailure(payload)) {
    return { event: 'advisor_failure_tracker.no_failure', requiresAdvisorConsultation: false, requiresAdvisorDisposition: false };
  }
  const update = updateFailureState(payload, options);
  const event = buildFailureEvent(payload, update, options);
  appendAuditEvent(event, options);
  return event;
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
    try {
      const event = parseInput(input);
      const rootDir = pick(event?.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd());
      if (!isAdvisorModeEnabled(rootDir)) {
        process.exit(0);
      }
      const result = trackFailure(event, { root: rootDir });
      if (result.requiresAdvisorConsultation) {
        process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: JSON.stringify(result) } }));
      }
    } catch {
      process.exitCode = 0;
    }
  });
}

if (require.main === module) main();

module.exports = {
  getExitCode,
  normalizeFailureSignature,
  isFailure,
  updateFailureState,
  buildFailureEvent,
  trackFailure,
  main,
};
