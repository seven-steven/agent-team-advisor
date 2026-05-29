const fs = require('node:fs');
const path = require('node:path');
const { runtimePath } = require('./runtime-paths.js');
const { appendAuditEvent } = require('./audit-log.js');

const DIMENSIONS = ['advisorCalls', 'advisorTokens', 'advisorLatencyMs'];
const COUNTED_EVENTS = new Set(['advisor_call', 'advisor_recommendation', 'advisor_verdict', 'advisor_final_review']);

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function budgetStatePath(root, options = {}) {
  return runtimePath(root, ['state', 'advisor-budget.json'], options);
}

function loadBudgetPolicy(options = {}) {
  const root = getRoot(options);
  const policyPath = options.policyPath || path.join(root, '.claude', 'advisor-mode', 'policy.example.json');
  const policy = options.policy || (fs.existsSync(policyPath) ? JSON.parse(fs.readFileSync(policyPath, 'utf8')) : {});
  const budget = policy && policy.advisorMode && policy.advisorMode.budget;
  const scopes = budget && budget.scopes ? budget.scopes : {};
  return {
    enabled: budget && budget.enabled === true,
    overLimitMode: (budget && budget.overLimitMode) || 'degraded',
    scopes: {
      task: { ...(scopes.task || {}) },
      session: { ...(scopes.session || {}) },
    },
  };
}

function emptyUsage() {
  return { advisorCalls: 0, advisorTokens: 0, advisorLatencyMs: 0, eventKeys: {} };
}

function isValidUsage(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && DIMENSIONS.every((dimension) => Number.isFinite(Number(value[dimension] || 0)))
    && (!value.eventKeys || (typeof value.eventKeys === 'object' && !Array.isArray(value.eventKeys)));
}

function validateBudgetState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (!state.scopes || typeof state.scopes !== 'object' || Array.isArray(state.scopes)) return false;
  return Object.values(state.scopes).every(isValidUsage);
}

function readBudgetState(options = {}) {
  const root = getRoot(options);
  const statePath = options.statePath || budgetStatePath(root, options);
  if (!fs.existsSync(statePath)) return { version: 1, scopes: {} };
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (!validateBudgetState(state)) {
    const error = new Error('advisor budget state is invalid');
    error.code = 'advisor-budget-state-invalid';
    throw error;
  }
  return state;
}

function writeBudgetState(state, options = {}) {
  const root = getRoot(options);
  const statePath = options.statePath || budgetStatePath(root, options);
  if (!validateBudgetState(state)) throw new Error('advisor budget state is invalid');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return { ok: true, path: statePath, state };
}

function scopeKeyForBudget(input = {}) {
  const scope = input.scope;
  if (scope === 'task') return `task:${input.taskId || input.task_id || input.correlationKey || 'unknown'}`;
  if (scope === 'session') return `session:${input.sessionId || input.session_id || input.correlationKey || 'unknown'}`;
  throw new Error('budget scope must be task or session');
}

function eventKeyForUsage(input = {}) {
  const eventType = input.eventType || input.event || 'advisor_usage';
  const artifactRef = input.artifactRef || input.artifactPath || input.recommendationPath || input.verdict_ref || input.verdictRef;
  return [eventType, input.correlationKey || input.taskId || input.sessionId || 'unknown', artifactRef || 'direct'].join(':');
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function shouldIncrementCall(input = {}) {
  const eventType = input.eventType || input.event;
  if (input.workflowGateStatus === 'satisfied' || input.reusedArtifact === true || input.satisfiedRetry === true) return false;
  return COUNTED_EVENTS.has(eventType);
}

function applyUsage(usage, input) {
  const eventKey = eventKeyForUsage(input);
  if (usage.eventKeys[eventKey]) return false;
  usage.eventKeys[eventKey] = true;
  if (shouldIncrementCall(input)) usage.advisorCalls += 1;
  usage.advisorTokens += positiveNumber(input.advisorTokens ?? input.advisor_tokens);
  usage.advisorLatencyMs += positiveNumber(input.advisorLatencyMs ?? input.advisor_latency_ms);
  return true;
}

function budgetScopes(input = {}, policy) {
  return ['task', 'session'].filter((scope) => policy.scopes[scope] && Object.keys(policy.scopes[scope]).length > 0).map((scope) => ({ scope, key: scopeKeyForBudget({ ...input, scope }) }));
}

function recordAdvisorUsage(input = {}, options = {}) {
  const policy = loadBudgetPolicy(options);
  if (!policy.enabled) return { recorded: false, reasonCode: 'budget-disabled' };
  const state = readBudgetState(options);
  let recorded = false;
  for (const { key } of budgetScopes(input, policy)) {
    const usage = { ...emptyUsage(), ...(state.scopes[key] || {}) };
    usage.eventKeys = { ...(usage.eventKeys || {}) };
    if (applyUsage(usage, input)) recorded = true;
    state.scopes[key] = usage;
  }
  if (recorded) writeBudgetState(state, options);
  return { recorded, state };
}

function evaluateBudget(input = {}, options = {}) {
  const policy = loadBudgetPolicy(options);
  if (!policy.enabled) return { ok: true, degraded: false, reasonCode: 'budget-disabled' };
  const state = readBudgetState(options);
  const exceeded = [];
  for (const { scope, key } of budgetScopes(input, policy)) {
    const usage = { ...emptyUsage(), ...(state.scopes[key] || {}) };
    const caps = policy.scopes[scope];
    for (const dimension of DIMENSIONS) {
      if (Number.isFinite(Number(caps[dimension])) && Number(usage[dimension]) >= Number(caps[dimension])) {
        exceeded.push({ dimension, limit: Number(caps[dimension]), actual: Number(usage[dimension]), scope });
      }
    }
  }
  if (exceeded.length === 0) return { ok: true, degraded: false, reasonCode: 'advisor-budget-ok', exceeded: [] };
  const result = { ok: false, degraded: true, reasonCode: 'advisor-budget-exceeded', exceeded, eventType: input.eventType || input.event };
  try {
    appendAuditEvent(buildBudgetAuditEvent({ ...input, budgetStatus: result }), options);
  } catch {
    // Budget decisions should not fail solely because audit persistence failed.
  }
  return result;
}

function buildBudgetAuditEvent(input = {}) {
  const status = input.budgetStatus || input;
  return {
    event: 'budget.exceeded',
    eventType: input.eventType || status.eventType,
    reasonCode: status.reasonCode || 'advisor-budget-exceeded',
    exceeded: Array.isArray(status.exceeded) ? status.exceeded : [],
    correlationKey: input.correlationKey,
    taskId: input.taskId || input.task_id,
    sessionId: input.sessionId || input.session_id,
    policyRuleId: input.policyRuleId,
  };
}

module.exports = {
  loadBudgetPolicy,
  readBudgetState,
  writeBudgetState,
  recordAdvisorUsage,
  evaluateBudget,
  scopeKeyForBudget,
  buildBudgetAuditEvent,
};
