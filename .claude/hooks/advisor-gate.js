#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { runtimePath } = require('../advisor-mode/runtime-paths.js');
const { normalizeFailureSignature, normalizeRepeatedFailureKey } = require('./advisor-failure-tracker.js');
const {
  loadRouteConfig,
  resolveRoute,
  normalizeServedRoute,
} = require('../advisor-mode/provider-routing.js');

const GATED_MATCHER_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit']);
const READ_ONLY_SOURCE = 'read-only-advisor';
const ADVISOR_AGENT = 'advisor-reviewer';
const RISK_ORDER = ['low', 'medium', 'high', 'critical'];
const DEFAULT_FAILURE_STATE_FILE = ['state', 'failure-signatures.json'];
const CONSULTATION_REQUEST_PATH = ['consultations', 'requests'];
const CONSULTATION_RECOMMENDATION_PATH = ['consultations', 'recommendations'];
const DISPOSITION_PATH = ['decisions', 'dispositions'];

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
    actionClass: raw.actionClass || raw.action_class,
    failOpen: false,
  };
}

function buildGateEvent(raw) {
  const event = normalizeEvent(raw);
  return event || { failOpen: true, reasonCode: 'malformed-host-payload' };
}

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

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readPersistedFailureCount(rawEvent = {}, event = buildGateEvent(rawEvent), options = {}) {
  if (!event || event.failOpen) return { count: 0 };
  const root = getRoot(options);
  const statePath = options.failureStatePath || runtimePath(root, DEFAULT_FAILURE_STATE_FILE, options);
  const repeatedFailureKey = normalizeRepeatedFailureKey({
    ...rawEvent,
    toolName: event.toolName,
    toolInput: event.toolInput,
    taskState: event.taskState,
    actionClass: event.actionClass,
  });
  const state = readJson(statePath, { signatures: {} });
  const matches = Object.entries(state.signatures || {}).filter(([signature]) => signature.startsWith(`${repeatedFailureKey}|`));
  if (matches.length === 0) return { count: 0, repeatedFailureKey, statePath };
  let bestSignature;
  let bestRecord = { count: 0 };
  for (const [signature, record] of matches) {
    const count = Number(record && record.count ? record.count : 0);
    if (!bestSignature || count > Number(bestRecord.count || 0)) {
      bestSignature = signature;
      bestRecord = { ...record, count };
    }
  }
  return { count: Number(bestRecord.count || 0), signature: bestSignature, repeatedFailureKey, statePath };
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

function classifyToolClass(toolName, _toolInput, policy) {
  const toolClasses = requirePolicySection(policy, 'toolClasses');
  for (const [className, config] of Object.entries(toolClasses)) {
    if ((config.tools || []).includes(toolName)) return className;
  }
  return 'unknown';
}

function classifyActionClass(toolName, toolInput = {}, policy, event = {}) {
  const actionClasses = requirePolicySection(policy, 'actionClasses');
  const command = String(toolInput.command || '');
  const filePath = extractPath(toolInput);
  if (event.actionClass && actionClasses[event.actionClass]) return event.actionClass;
  for (const [className, config] of Object.entries(actionClasses)) {
    if (matchesAny(command, config.commandPatterns || [])) return className;
    if (matchesAny(filePath, config.pathPatterns || [])) return className;
    if ((config.tools || []).includes(toolName)) return className;
  }
  return 'low-risk';
}

function pathMatchesConfig(filePath, config = {}) {
  if ((config.exceptions || []).includes(filePath)) return false;
  if ((config.files || []).includes(filePath)) return true;
  if ((config.prefixes || []).some((prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`))) return true;
  return matchesAny(filePath, config.patterns || []);
}

function classifyPathClass(_toolName, toolInput = {}, policy) {
  const filePath = extractPath(toolInput);
  if (!filePath) return 'none';
  const protectedSurfaces = policy && policy.advisorMode && policy.advisorMode.gates && policy.advisorMode.gates.protectedSurfaces;
  if (protectedSurfaces) {
    if ((protectedSurfaces.exceptions || []).includes(filePath)) return 'ordinary';
    const classes = Object.entries(protectedSurfaces.classes || {});
    for (const [className, config] of classes) {
      if ((config.files || []).includes(filePath)) return className;
    }
    for (const [className, config] of classes) {
      if ((config.prefixes || []).some((prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`))) return className;
      if (matchesAny(filePath, config.patterns || [])) return className;
    }
  }
  const pathClasses = requirePolicySection(policy, 'pathClasses');
  for (const [className, config] of Object.entries(pathClasses)) {
    if (pathMatchesConfig(filePath, config)) return className;
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
    requestPath: runtimePath(root, [...CONSULTATION_REQUEST_PATH, `${correlationKey}.json`], options),
    recommendationPath: runtimePath(root, [...CONSULTATION_RECOMMENDATION_PATH, `${correlationKey}.json`], options),
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

function loadRuntimeRouteConfig(options = {}) {
  const root = getRoot(options);
  const localPath = path.join(root, '.claude', 'advisor-mode', 'provider-routes.json');
  const examplePath = path.join(root, '.claude', 'advisor-mode', 'provider-routes.example.json');
  const routeConfigPath = fs.existsSync(localPath) ? localPath : examplePath;
  return loadRouteConfig(routeConfigPath, { root });
}

function buildRuntimeRouteMetadata(input = {}, options = {}) {
  const requestedAlias = input.requestedAlias || 'opus';
  const loaded = loadRuntimeRouteConfig(options);
  if (!loaded.ok) {
    return {
      ok: false,
      requestedAlias,
      routeConfigPath: loaded.configPath,
      conformanceStatus: 'unknown',
      reasonCode: 'route-config-load-failed',
      errors: loaded.errors,
    };
  }
  const resolution = resolveRoute(loaded.config, requestedAlias, { routeConfigPath: loaded.configPath });
  if (!resolution.ok) {
    return {
      ok: false,
      requestedAlias,
      routeConfigPath: loaded.configPath,
      conformanceStatus: 'unknown',
      reasonCode: resolution.reasonCode,
      errors: resolution.errors,
    };
  }
  return {
    ok: true,
    requestedAlias,
    resolvedProvider: resolution.provider,
    resolvedModel: resolution.model,
    endpointRef: resolution.endpointRef,
    configuredProvider: resolution.provider,
    configuredModel: resolution.model,
    providerAlias: resolution.provider,
    endpointAlias: resolution.endpointRef,
    routeConfigPath: loaded.configPath,
    conformanceStatus: resolution.conformanceStatus || 'unchecked',
  };
}

function buildAdvisorObservedRoute(input = {}, routeResolution = {}) {
  const sourceField = 'advisorRecommendation.providerResponse.body.model';
  const providerResponse = input.advisorRecommendation && input.advisorRecommendation.providerResponse;
  const route = normalizeServedRoute(providerResponse, {
    source: 'provider-response',
    sourceField,
    providerAlias: routeResolution.providerAlias,
    endpointAlias: routeResolution.endpointAlias,
  });
  return route;
}

function buildRequest(event, classes, rule, paths, options = {}) {
  const risk = rule.risk || 'high';
  const routeResolution = buildRuntimeRouteMetadata({ requestedAlias: event.requestedAlias || 'opus' }, options);
  const observedRoute = buildAdvisorObservedRoute(options, routeResolution);
  const request = {
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
    routeResolution,
    observedRoute,
    observedModel: observedRoute.observed ? observedRoute.observedModel : undefined,
    advisorProducer: buildAdvisorProducerInstruction(paths.requestPath, paths.recommendationPath),
  };
  if (rule.auditLabel) request.auditLabel = rule.auditLabel;
  return request;
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

const CRITICAL_DECISION_CLASSES = new Set([
  'irreversible',
  'security-boundary',
  'shared-production',
  'governance-configuration',
  'destructive',
  'force-push',
  'credential-control',
  'production-affecting',
]);
const HUMAN_DISPOSITIONS = ['approve', 'reject', 'revise', 'defer'];

function getDispositionPath(correlationKey, options = {}) {
  return options.dispositionPath || runtimePath(getRoot(options), [...DISPOSITION_PATH, `${correlationKey}.json`], options);
}

function getHumanRecommendationPath(correlationKey, options = {}) {
  return options.recommendationPath || runtimePath(getRoot(options), [...CONSULTATION_RECOMMENDATION_PATH, `${correlationKey}.json`], options);
}

function getHumanRequestPath(correlationKey, options = {}) {
  return options.requestPath || runtimePath(getRoot(options), [...CONSULTATION_REQUEST_PATH, `${correlationKey}.json`], options);
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

function advisoryOnlyResult(base, reason, additionalContext) {
  return {
    ...base,
    gateAction: 'advisory',
    advisoryOnly: true,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: additionalContext || reason,
      },
    },
  };
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

function buildDecisionPacket(input = {}, options = {}) {
  const correlationKey = input.correlationKey || buildCorrelationKey({
    hookEventName: 'HumanApproval',
    toolName: input.decisionClass || 'human-decision',
    toolInput: { decisionSummary: input.decisionSummary || '' },
    taskState: 'human-approval',
  });
  const decisionClass = input.decisionClass || input.actionClass || 'unknown';
  const requestPath = getHumanRequestPath(correlationKey, options);
  const recommendationPath = getHumanRecommendationPath(correlationKey, options);
  const dispositionPath = getDispositionPath(correlationKey, options);
  const request = {
    correlationKey,
    event: 'advisor_consultation.required',
    triggerReason: input.triggerReason || 'Critical human decision requires read-only advisor recommendation first.',
    risk: input.riskLevel || input.risk || 'critical',
    toolName: input.toolName || 'workflow-decision',
    toolClass: input.toolClass || 'workflow',
    actionClass: decisionClass,
    pathClass: input.pathClass || 'none',
    policyRuleId: input.policyRuleId || 'human-critical-decision',
    consultationTiming: 'before-proceed',
    requestPath,
    recommendationPath,
    advisorProducer: buildAdvisorProducerInstruction(requestPath, recommendationPath),
  };
  if (input.auditLabel) request.auditLabel = input.auditLabel;

  const readResult = readAdvisorRecommendation(recommendationPath);
  if (!readResult.ok || !validateAdvisorRecommendation(readResult.recommendation, request)) {
    try {
      writeConsultationRequest(request);
    } catch {
      return hardStop('request-write-failed', 'Advisor Mode consultation request could not be written; blocking human decision gate.');
    }
    return {
      ...request,
      workflowGateStatus: 'blocked-pending-advisor',
      retryRequired: true,
      reentryAllowed: false,
      reasonCode: readResult.reasonCode || 'invalid-recommendation-artifact',
    };
  }

  if (!CRITICAL_DECISION_CLASSES.has(decisionClass)) {
    return { gateAction: 'none', reasonCode: 'non-critical-decision-class', correlationKey };
  }

  const packet = {
    correlationKey,
    event: 'human_approval.required',
    triggerReason: request.triggerReason,
    decisionSummary: input.decisionSummary || request.triggerReason,
    decisionClass,
    riskLevel: request.risk,
    options: HUMAN_DISPOSITIONS.map((disposition) => ({
      disposition,
      label: disposition,
      requiresExplicitRetry: true,
    })),
    advisorRecommendation: readResult.recommendation,
    expectedConsequences: Array.isArray(input.expectedConsequences) ? input.expectedConsequences : [],
    suggestedVerificationPoints: Array.isArray(input.suggestedVerificationPoints) ? input.suggestedVerificationPoints : [],
    workflowGateStatus: 'blocked-pending-human',
    dispositionPath,
    retryRequired: true,
    reentryAllowed: false,
    requiresExplicitRetry: true,
    hostWaitAndResume: false,
  };
  if (input.auditLabel) packet.auditLabel = input.auditLabel;
  return packet;
}

function writeDisposition(dispositionInput = {}, options = {}) {
  const correlationKey = dispositionInput.correlationKey;
  const artifactPath = getDispositionPath(correlationKey, options);
  const artifact = {
    correlationKey,
    event: 'human_approval.disposition',
    disposition: dispositionInput.disposition,
    decidedBy: dispositionInput.decidedBy,
    decidedAt: dispositionInput.decidedAt || new Date().toISOString(),
    rationale: dispositionInput.rationale,
    appliesTo: dispositionInput.appliesTo,
  };
  if (Array.isArray(dispositionInput.conditions)) artifact.conditions = dispositionInput.conditions;
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return { ...artifact, path: artifactPath };
}

function readDisposition(correlationKey, options = {}) {
  const dispositionPath = getDispositionPath(correlationKey, options);
  try {
    return { ok: true, disposition: JSON.parse(fs.readFileSync(dispositionPath, 'utf8')), path: dispositionPath };
  } catch (error) {
    return { ok: false, reasonCode: error.code === 'ENOENT' ? 'missing-disposition' : 'invalid-disposition-json', path: dispositionPath };
  }
}

function validateDisposition(disposition, packet) {
  if (!disposition || typeof disposition !== 'object' || Array.isArray(disposition)) return false;
  if (disposition.correlationKey !== packet.correlationKey) return false;
  if (disposition.event !== 'human_approval.disposition') return false;
  if (!HUMAN_DISPOSITIONS.includes(disposition.disposition)) return false;
  if (!isString(disposition.decidedBy) || !isString(disposition.decidedAt) || !isString(disposition.rationale)) return false;
  if (!disposition.appliesTo || disposition.appliesTo.event !== packet.event) return false;
  if (disposition.conditions !== undefined && !Array.isArray(disposition.conditions)) return false;
  return true;
}

function evaluateHumanGateReentry(packet = {}, options = {}) {
  const correlationKey = packet.correlationKey;
  const readResult = readDisposition(correlationKey, { ...options, dispositionPath: options.dispositionPath || packet.dispositionPath });
  const base = {
    correlationKey,
    workflowGateStatus: 'blocked-pending-human',
    retryRequired: true,
    reentryAllowed: false,
    requiresExplicitRetry: true,
    hostWaitAndResume: false,
    dispositionPath: readResult.path,
  };
  if (!readResult.ok) return { ...base, reasonCode: readResult.reasonCode };
  if (!validateDisposition(readResult.disposition, packet)) return { ...base, reasonCode: 'invalid-disposition-artifact' };
  return {
    ...base,
    workflowGateStatus: 'satisfied',
    reentryAllowed: true,
    disposition: readResult.disposition.disposition,
    reasonCode: 'valid-disposition',
  };
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
  const root = getRoot(options);
  if (!isAdvisorModeEnabled(root)) return { gateAction: 'none', reasonCode: 'advisor-mode-disabled' };
  const strictMode = isAdvisorModeStrict(root);
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
  const persistedFailure = readPersistedFailureCount(rawEvent, event, options);
  if (persistedFailure.count > event.failureCount) event.failureCount = persistedFailure.count;
  try {
    classes = {
      toolClass: classifyToolClass(event.toolName, event.toolInput, policy),
      actionClass: classifyActionClass(event.toolName, event.toolInput, policy, event),
      pathClass: classifyPathClass(event.toolName, event.toolInput, policy),
    };
  } catch (error) {
    return hardStop('classification-failed', 'Advisor Mode risk classification failed; blocking configured gate event.');
  }

  const rule = matchingRule(event, classes, policy);
  if (!rule) return { gateAction: 'none', classes };

  const paths = getConsultationPaths(event, options);
  const request = buildRequest(event, classes, rule, paths, options);
  if (rule.gateAction === 'human-approval') {
    const decisionPacket = buildDecisionPacket(
      {
        correlationKey: paths.correlationKey,
        decisionClass: classes.actionClass,
        toolName: event.toolName,
        toolClass: classes.toolClass,
        pathClass: classes.pathClass,
        risk: rule.risk || 'critical',
        policyRuleId: rule.id,
        triggerReason: rule.triggerReason,
        decisionSummary: `${rule.triggerReason || rule.id}: ${extractPath(event.toolInput)}`,
        auditLabel: rule.auditLabel,
      },
      { ...options, requestPath: paths.requestPath, recommendationPath: paths.recommendationPath },
    );
    if (decisionPacket.gateAction === 'hard-stop') return decisionPacket;
    if (decisionPacket.workflowGateStatus === 'blocked-pending-advisor') {
      return strictMode
        ? {
            ...decisionPacket,
            gateAction: 'block',
            policyRuleId: rule.id,
            actionClass: classes.actionClass,
            hookOutput: buildDecision(
              'deny',
              'Advisor consultation is required before this critical workflow path proceeds. Retry only after the recommendation artifact exists and validates.',
              `Advisor request: ${paths.requestPath}\nAdvisor recommendation: ${paths.recommendationPath}\n${decisionPacket.advisorProducer.instruction}`,
            ),
          }
        : advisoryOnlyResult(
            {
              ...decisionPacket,
              workflowGateStatus: 'advisory-pending-advisor',
              policyRuleId: rule.id,
              actionClass: classes.actionClass,
            },
            'Advisor consultation is recommended before this critical workflow path proceeds.',
            `Advisor request: ${paths.requestPath}\nAdvisor recommendation: ${paths.recommendationPath}`,
          );
    }
    const reentry = evaluateHumanGateReentry(decisionPacket, options);
    if (reentry.workflowGateStatus === 'satisfied') {
      return { ...decisionPacket, ...reentry, gateAction: 'allow', policyRuleId: rule.id };
    }
    return strictMode
      ? { ...decisionPacket, ...reentry, gateAction: 'block', policyRuleId: rule.id }
      : advisoryOnlyResult(
          {
            ...decisionPacket,
            ...reentry,
            workflowGateStatus: 'advisory-pending-human',
            policyRuleId: rule.id,
          },
          'Human approval disposition is recommended before retrying this workflow path.',
        );
  }

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
      event: request.event,
      triggerReason: request.triggerReason,
      risk: request.risk,
      toolName: request.toolName,
      toolClass: request.toolClass,
      actionClass: classes.actionClass,
      pathClass: request.pathClass,
      policyRuleId: rule.id,
      failureSignature: persistedFailure.signature,
      failureCount: event.failureCount,
      hookOutput: buildDecision('allow', 'Valid read-only advisor recommendation exists; explicit retry may proceed.'),
    };
  }

  try {
    writeConsultationRequest(request);
  } catch (error) {
    return hardStop('request-write-failed', 'Advisor Mode consultation request could not be written; blocking configured gate event.');
  }

  return strictMode
    ? {
        gateAction: 'block',
        workflowGateStatus: 'blocked-pending-advisor',
        retryRequired: true,
        reentryAllowed: false,
        reasonCode: readResult.reasonCode || 'invalid-recommendation-artifact',
        correlationKey: paths.correlationKey,
        requestPath: paths.requestPath,
        recommendationPath: paths.recommendationPath,
        policyRuleId: rule.id,
        auditLabel: rule.auditLabel,
        actionClass: classes.actionClass,
        failureSignature: persistedFailure.signature,
        failureCount: event.failureCount,
        hookOutput: buildDecision(
          'deny',
          'Advisor consultation is required before this high-risk workflow path proceeds. Retry only after the recommendation artifact exists and validates.',
          `Advisor request: ${paths.requestPath}\nAdvisor recommendation: ${paths.recommendationPath}\n${request.advisorProducer.instruction}`,
        ),
      }
    : advisoryOnlyResult(
        {
          workflowGateStatus: 'advisory-pending-advisor',
          retryRequired: true,
          reentryAllowed: false,
          reasonCode: readResult.reasonCode || 'invalid-recommendation-artifact',
          correlationKey: paths.correlationKey,
          requestPath: paths.requestPath,
          recommendationPath: paths.recommendationPath,
          policyRuleId: rule.id,
          auditLabel: rule.auditLabel,
          actionClass: classes.actionClass,
          failureSignature: persistedFailure.signature,
          failureCount: event.failureCount,
        },
        'Advisor consultation is recommended before this high-risk workflow path proceeds.',
        `Advisor request: ${paths.requestPath}\nAdvisor recommendation: ${paths.recommendationPath}`,
      );
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
  buildRuntimeRouteMetadata,
  buildRequest,
  buildDecisionPacket,
  writeDisposition,
  readDisposition,
  validateDisposition,
  evaluateHumanGateReentry,
  readPersistedFailureCount,
  evaluateGatePolicy,
  buildGateEvent,
  main,
};
