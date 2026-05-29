const fs = require('node:fs');
const path = require('node:path');
const { appendAuditEvent } = require('./audit-log.js');

const CAPABILITIES = ['advisorConsultation', 'finalReview', 'criticalHumanApproval', 'protectedSurfaces'];

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readHooksConfig(root) {
  try {
    const configPath = path.join(root, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.hooks || {};
  } catch {
    return {};
  }
}

function modeFromHooks(hooks = {}) {
  if (hooks.advisor_mode === false) return 'disabled';
  if (hooks.advisor_mode === true && hooks.advisor_mode_strict === false) return 'warning-only';
  if (hooks.advisor_mode === true && hooks.advisor_mode_strict === true) return 'enforce';
  return 'disabled';
}

function buildCapabilities(hooks = {}, mode = modeFromHooks(hooks)) {
  const configured = hooks.advisor_mode_capabilities || {};
  const capabilities = {};
  for (const capability of CAPABILITIES) {
    capabilities[capability] = mode === 'disabled' ? false : configured[capability] !== false;
  }
  return capabilities;
}

function readOperatorMode(root, options = {}) {
  const actualRoot = root || getRoot(options);
  const hooks = readHooksConfig(actualRoot);
  const mode = modeFromHooks(hooks);
  return {
    mode,
    strict: mode === 'enforce',
    capabilities: buildCapabilities(hooks, mode),
    configPath: path.join(actualRoot, '.planning', 'config.json'),
  };
}

function isCapabilityEnabled(modeInput, capability) {
  const mode = typeof modeInput === 'string' ? { mode: modeInput, capabilities: buildCapabilities({}, modeInput) } : modeInput;
  if (!CAPABILITIES.includes(capability)) return false;
  if (!mode || mode.mode === 'disabled') return false;
  return mode.capabilities ? mode.capabilities[capability] === true : true;
}

function buildRecoveryAuditEvent(mode, options = {}) {
  return {
    event: 'operator_recovery.mode_checked',
    mode: mode.mode,
    strict: mode.strict === true,
    capabilities: { ...mode.capabilities },
    capability: options.capability,
    gateAction: options.gateAction,
    reasonCode: options.reasonCode,
    correlationKey: options.correlationKey,
    taskId: options.taskId || options.task_id,
    sessionId: options.sessionId || options.session_id,
  };
}

function evaluateOperatorRecovery(event = {}, options = {}) {
  const root = getRoot(options);
  const mode = readOperatorMode(root, options);
  const capability = event.capability || options.capability || 'advisorConsultation';
  const enabled = isCapabilityEnabled(mode, capability);
  const result = {
    ...mode,
    capability,
    capabilityEnabled: enabled,
    gateAction: enabled ? 'continue' : 'none',
    reasonCode: enabled ? 'operator-mode-enabled' : mode.mode === 'disabled' ? 'advisor-mode-disabled' : 'operator-capability-disabled',
  };
  try {
    appendAuditEvent(buildRecoveryAuditEvent(result, { ...event, ...options }), { ...options, root });
  } catch {
    // Recovery mode checks must not fail solely because audit persistence failed.
  }
  return result;
}

module.exports = {
  readOperatorMode,
  evaluateOperatorRecovery,
  isCapabilityEnabled,
  buildRecoveryAuditEvent,
  CAPABILITIES,
};
