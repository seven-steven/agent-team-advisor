#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const GATED_MATCHER_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit']);
const READ_ONLY_SOURCE = 'read-only-advisor';
const ADVISOR_AGENT = 'advisor-reviewer';
const RISK_ORDER = ['low', 'medium', 'high', 'critical'];

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const toolName = raw.toolName || raw.tool_name;
  if (!toolName) {
    return {
      hookEventName: raw.hookEventName || raw.hook_event_name || 'PreToolUse',
      failOpen: true,
      reasonCode: 'missing-tool-name',
    };
  }
  return {
    hookEventName: raw.hookEventName || raw.hook_event_name || 'PreToolUse',
    toolName,
    toolInput: raw.toolInput || raw.tool_input || {},
    taskState: raw.taskState || raw.task_state || 'unknown',
    failureCount: Number(raw.failureCount ?? raw.failure_count ?? 0),
    failOpen: false,
  };
}

function buildGateEvent(raw) {
  const event = normalizeEvent(raw);
  return event || { failOpen: true, reasonCode: 'malformed-host-payload' };
}

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function loadPolicy(options = {}) {
  const root = getRoot(options);
  const policyPath = options.policyPath || path.join(root, '.claude', 'advisor-mode', 'policy.example.json');
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy.advisorMode || !policy.advisorMode.gates) {
    throw new Error('advisorMode.gates policy is required');
  }
  return policy;
}

function requirePolicySection(policy, section) {
  const gates = policy && policy.advisorMode && policy.advisorMode.gates;
  if (!gates || !gates[section]) throw new Error(`${section} policy is required`);
  return gates[section];
}

function matchesAny(text, patterns = []) {
  return patterns.some((pattern) => new RegExp(pattern, 'i').test(text));
}

function extractPath(toolInput = {}) {
  return String(toolInput.file_path || toolInput.path || toolInput.notebook_path || '');
}

function classifyToolClass(toolName, toolInput, policy) {
  const toolClasses = requirePolicySection(policy, 'toolClasses');
  for (const [className, config] of Object.entries(toolClasses)) {
    if ((config.tools || []).includes(toolName)) return className;
  }
  return 'unknown';
}

function classifyActionClass(toolName, toolInput = {}, policy) {
  const actionClasses = requirePolicySection(policy, 'actionClasses');
  const command = String(toolInput.command || '');
  const filePath = extractPath(toolInput);
  for (const [className, config] of Object.entries(actionClasses)) {
    if (matchesAny(command, config.commandPatterns || [])) return className;
    if (matchesAny(filePath, config.pathPatterns || [])) return className;
    if ((config.tools || []).includes(toolName)) return className;
  }
  return 'low-risk';
}

function classifyPathClass(toolName, toolInput = {}, policy) {
  const pathClasses = requirePolicySection(policy, 'pathClasses');
  const filePath = extractPath(toolInput);
  if (!filePath) return 'none';
  for (const [className, config] of Object.entries(pathClasses)) {
    if ((config.prefixes || []).some((prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`))) return className;
    if ((config.files || []).includes(filePath)) return className;
    if (matchesAny(filePath, config.patterns || [])) return className;
  }
  return 'ordinary';
}

function valueMatches(expected, actual) {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) return expected.includes(actual);
  if (typeof expected === 'number') return Number(actual) >= expected;
  return expected === actual;
}

function taskStateMatches(expected, actual) {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) return expected.includes(actual);
  return expected === actual;
}

function matchingRule(event, classes, policy) {
  const gates = policy.advisorMode.gates;
  for (const rule of gates.rules || []) {
    const when = rule.when || {};
    const failureThreshold = when.failureCountAtLeast ?? rule.failureThreshold;
    if (!valueMatches(when.toolClass, classes.toolClass)) continue;
    if (!valueMatches(when.actionClass, classes.actionClass)) continue;
    if (!valueMatches(when.pathClass, classes.pathClass)) continue;
    if (!taskStateMatches(when.taskState, event.taskState)) continue;
    if (failureThreshold !== undefined && Number(event.failureCount || 0) < Number(failureThreshold)) continue;
    return rule;
  }
  return null;
}

function buildCorrelationKey(event) {
  const material = stableStringify({
    hookEventName: event.hookEventName || 'PreToolUse',
    toolName: event.toolName,
    toolInput: event.toolInput || {},
    taskState: event.taskState || 'unknown',
  });
  return `advisor-consultation-${crypto.createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

function getConsultationPaths(event, options = {}) {
  const root = getRoot(options);
  const correlationKey = event.correlationKey || buildCorrelationKey(event);
  return {
    correlationKey,
    requestPath: path.join(root, '.advisor', 'consultations', 'requests', `${correlationKey}.json`),
    recommendationPath: path.join(root, '.advisor', 'consultations', 'recommendations', `${correlationKey}.json`),
  };
}

function buildAdvisorProducerInstruction(requestPath, recommendationPath) {
  return {
    surface: 'subagent-or-SendMessage',
    agent: ADVISOR_AGENT,
    inputPath: requestPath,
    outputPath: recommendationPath,
    instruction:
      `Executor must trigger the read-only advisor-reviewer surface with ${requestPath} as input, ` +
      `then persist the structured advisor recommendation at ${recommendationPath}. ` +
      'Advisor remains read-only; executor retains all mutation and command authority.',
  };
}

function buildRequest(event, classes, rule, paths) {
  const risk = rule.risk || 'high';
  return {
    correlationKey: paths.correlationKey,
    event: 'advisor_consultation.required',
    triggerReason: rule.triggerReason || rule.id || 'high-risk advisor consultation required',
    risk,
    toolName: event.toolName,
    toolClass: classes.toolClass,
    actionClass: classes.actionClass,
    pathClass: classes.pathClass,
    policyRuleId: rule.id,
    consultationTiming: 'before-proceed',
    requestPath: paths.requestPath,
    recommendationPath: paths.recommendationPath,
    advisorProducer: buildAdvisorProducerInstruction(paths.requestPath, paths.recommendationPath),
  };
}

function writeConsultationRequest(request) {
  fs.mkdirSync(path.dirname(request.requestPath), { recursive: true });
  fs.writeFileSync(request.requestPath, JSON.stringify(request, null, 2) + '\n');
  return request.requestPath;
}

function readAdvisorRecommendation(recommendationPath) {
  try {
    return { ok: true, recommendation: JSON.parse(fs.readFileSync(recommendationPath, 'utf8')) };
  } catch (error) {
    return {
      ok: false,
      reasonCode: error.code === 'ENOENT' ? 'missing-recommendation' : 'invalid-recommendation-json',
    };
  }
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAdvisorRecommendation(recommendation, request) {
  const required = [
    'correlationKey',
    'source',
    'advisorAgent',
    'status',
    'risk',
    'confidence',
    'recommendation',
    'rationale',
    'blockingFindings',
    'recommendedActions',
    'verificationGuidance',
    'requestPath',
  ];
  if (!recommendation || typeof recommendation !== 'object') return false;
  if (!required.every((key) => Object.prototype.hasOwnProperty.call(recommendation, key))) return false;
  if (recommendation.correlationKey !== request.correlationKey) return false;
  if (recommendation.source !== READ_ONLY_SOURCE) return false;
  if (recommendation.advisorAgent !== ADVISOR_AGENT) return false;
  if (recommendation.requestPath !== request.requestPath) return false;
  if (!['PASS', 'CONCERNS', 'FAIL', 'BLOCKED'].includes(recommendation.status)) return false;
  if (!RISK_ORDER.includes(recommendation.risk)) return false;
  if (!['low', 'medium', 'high'].includes(recommendation.confidence)) return false;
  if (!isString(recommendation.recommendation) || !isString(recommendation.rationale)) return false;
  return ['blockingFindings', 'recommendedActions', 'verificationGuidance'].every((key) =>
    Array.isArray(recommendation[key]) && recommendation[key].every(isString),
  );
}

function buildDecision(permissionDecision, reason, additionalContext) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason: reason,
    },
  };
  if (additionalContext) output.hookSpecificOutput.additionalContext = additionalContext;
  return output;
}

function hardStop(reasonCode, message) {
  return {
    gateAction: 'hard-stop',
    workflowGateStatus: 'hard-stop',
    retryRequired: false,
    reentryAllowed: false,
    reasonCode,
    hookOutput: buildDecision('deny', message, `Advisor Mode hard stop: ${reasonCode}`),
  };
}

function evaluateGatePolicy(rawEvent, options = {}) {
  const event = buildGateEvent(rawEvent);
  if (event.failOpen) return { gateAction: 'none', failOpen: true, reasonCode: event.reasonCode };
  if (!GATED_MATCHER_TOOLS.has(event.toolName)) return { gateAction: 'none' };

  let policy;
  try {
    policy = loadPolicy(options);
  } catch (error) {
    return hardStop('policy-load-failed', 'Advisor Mode policy could not be loaded; blocking configured gate event.');
  }

  let classes;
  try {
    classes = {
      toolClass: classifyToolClass(event.toolName, event.toolInput, policy),
      actionClass: classifyActionClass(event.toolName, event.toolInput, policy),
      pathClass: classifyPathClass(event.toolName, event.toolInput, policy),
    };
  } catch (error) {
    return hardStop('classification-failed', 'Advisor Mode risk classification failed; blocking configured gate event.');
  }

  const rule = matchingRule(event, classes, policy);
  if (!rule) return { gateAction: 'none', classes };

  const paths = getConsultationPaths(event, options);
  const request = buildRequest(event, classes, rule, paths);
  const readResult = readAdvisorRecommendation(paths.recommendationPath);
  if (readResult.ok && validateAdvisorRecommendation(readResult.recommendation, request)) {
    return {
      gateAction: 'allow',
      workflowGateStatus: 'satisfied',
      retryRequired: true,
      reentryAllowed: true,
      correlationKey: paths.correlationKey,
      requestPath: paths.requestPath,
      recommendationPath: paths.recommendationPath,
      policyRuleId: rule.id,
      hookOutput: buildDecision('allow', 'Valid read-only advisor recommendation exists; explicit retry may proceed.'),
    };
  }

  try {
    writeConsultationRequest(request);
  } catch (error) {
    return hardStop('request-write-failed', 'Advisor Mode consultation request could not be written; blocking configured gate event.');
  }

  return {
    gateAction: 'block',
    workflowGateStatus: 'blocked-pending-advisor',
    retryRequired: true,
    reentryAllowed: false,
    reasonCode: readResult.reasonCode || 'invalid-recommendation-artifact',
    correlationKey: paths.correlationKey,
    requestPath: paths.requestPath,
    recommendationPath: paths.recommendationPath,
    policyRuleId: rule.id,
    hookOutput: buildDecision(
      'deny',
      'Advisor consultation is required before this high-risk workflow path proceeds. Retry only after the recommendation artifact exists and validates.',
      `Advisor request: ${paths.requestPath}\nAdvisor recommendation: ${paths.recommendationPath}\n${request.advisorProducer.instruction}`,
    ),
  };
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
    const result = evaluateGatePolicy(event);
    if (result.hookOutput) process.stdout.write(JSON.stringify(result.hookOutput));
    if (result.gateAction === 'hard-stop') process.exitCode = 2;
  });
}

if (require.main === module) main();

module.exports = {
  loadPolicy,
  classifyToolClass,
  classifyActionClass,
  classifyPathClass,
  buildCorrelationKey,
  getConsultationPaths,
  writeConsultationRequest,
  readAdvisorRecommendation,
  buildAdvisorProducerInstruction,
  validateAdvisorRecommendation,
  evaluateGatePolicy,
  buildGateEvent,
  main,
};
