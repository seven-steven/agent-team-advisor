# Phase 5: Audit, Budget, and Operator Recovery - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 11 new/modified file targets inferred from Phase 5 context
**Analogs found:** 11 / 11

> Note: `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/worktrees/agent-a0cd49c9aeb1ec37c/.planning/phases/05-audit-budget-and-operator-recovery/05-CONTEXT.md` was not present in this worktree. The available phase input at `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/worktrees/agent-a0cd49c9aeb1ec37c/.planning/phases/05-audit-budget-and-operator-recovery/05-RESEARCH.md` contained the Phase 5 context/decisions and was used as scope.

## File Classification

| New/Modified File                                                                                       | Role            | Data Flow                             | Closest Analog                                                                                                          | Match Quality   |
| ------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| `.claude/advisor-mode/audit-log.js`                                                                         | service/utility | file-I/O, transform                   | `.claude/hooks/executor-route-audit.js`                                                                                 | exact           |
| `.claude/advisor-mode/budget-state.js`                                                                        | service/utility | file-I/O, request-response            | `.claude/hooks/advisor-gate.js`                                                                                         | role-match      |
| `.claude/advisor-mode/operator-recovery.js`                                                             | service/utility | file-I/O, request-response            | `.claude/hooks/advisor-gate.js`                                                                                         | role-match      |
| `.claude/advisor-mode/doctor.js`                                                                        | service/CLI     | request-response, streaming, file-I/O | `.claude/advisor-mode/provider-conformance.js`                                                                          | exact           |
| `.claude/hooks/advisor-gate.js`                                                                         | middleware/hook | request-response, file-I/O            | `.claude/hooks/advisor-gate.js`                                                                                         | modify-existing |
| `.claude/hooks/advisor-final-review-gate.js`                                                            | middleware/hook | request-response, file-I/O            | `.claude/hooks/advisor-final-review-gate.js`                                                                            | modify-existing |
| `.claude/advisor-mode/runtime-paths.js`                                                                 | utility         | file-I/O                              | `.claude/advisor-mode/runtime-paths.js`                                                                                 | modify-existing |
| `.claude/advisor-mode/policy.example.json`                                                              | config          | request-response                      | `.claude/advisor-mode/policy.example.json`                                                                              | modify-existing |
| `.claude/advisor-mode/*.schema.json` for audit/budget/doctor/recovery artifacts                         | model/config    | transform, file-I/O                   | `.claude/advisor-mode/provider-conformance.schema.json` + `.claude/advisor-mode/policy.example.json`                    | role-match      |
| `.claude/settings.json`                                                                                 | config          | event-driven                          | existing hook settings referenced by tests                                                                              | role-match      |
| `.claude/advisor-mode/tests/audit-log.test.js`, `.claude/advisor-mode/tests/budget-state.test.js`, `.claude/advisor-mode/tests/rollback.test.js`, `.claude/advisor-mode/tests/doctor.test.js` | test            | file-I/O, request-response            | `.claude/advisor-mode/tests/provider-conformance.test.js`, `.claude/advisor-mode/tests/failure-and-human-gates.test.js` | exact           |

## Pattern Assignments

### `.claude/advisor-mode/audit-log.js` (service/utility, file-I/O + transform)

**Analog:** `.claude/hooks/executor-route-audit.js`

**Imports/runtime path pattern** (lines 0-9):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { runtimePath } = require("../advisor-mode/runtime-paths.js");
```

**Correlation key fallback pattern** (lines 20-26):

```javascript
function runtimeCorrelationId(input = {}) {
  if (typeof input.session_id === "string" && input.session_id.length > 0)
    return input.session_id;
  if (typeof input.sessionId === "string" && input.sessionId.length > 0)
    return input.sessionId;
  if (
    typeof input.correlationKey === "string" &&
    input.correlationKey.length > 0
  )
    return input.correlationKey;
  const material = JSON.stringify({
    hookEventName: input.hookEventName,
    transcript_path: input.transcript_path || input.transcriptPath || "",
  });
  return `executor-route-${crypto.createHash("sha256").update(material).digest("hex").slice(0, 16)}`;
}
```

**Build structured audit event pattern** (lines 28-39, 65-81):

```javascript
function buildExecutorRouteAuditEvent(input = {}, options = {}) {
  const root = getRoot(options);
  const requestedAlias = input.requestedAlias || "sonnet";
  const configPath = options.routeConfigPath || routeConfigPath(root);
  const loaded = loadRouteConfig(configPath, { root });
  const base = {
    event: "provider_route.executor_call",
    requestedAlias,
    routeConfigPath: configPath,
    recordedAt: options.now || new Date().toISOString(),
    runtimeCorrelationId: runtimeCorrelationId(input),
  };
  // ...
  return {
    ...base,
    ok: true,
    resolvedProvider: resolution.provider,
    resolvedModel: resolution.model,
    endpointRef: resolution.endpointRef,
    configuredProvider: resolution.provider,
    configuredModel: resolution.model,
    providerAlias: resolution.provider,
    endpointAlias: resolution.endpointRef,
    conformanceStatus: resolution.conformanceStatus || "unchecked",
    observedModel: observedRoute.observed ? observedRoute.observedModel : null,
    source: observedRoute.source,
    sourceField: observedRoute.sourceField,
    responseId: observedRoute.responseId,
    observedRoute,
  };
}
```

**Append-only raw audit + per-event artifact pattern** (lines 84-99):

```javascript
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function recordExecutorRouteResolution(input = {}, options = {}) {
  const root = getRoot(options);
  const event = buildExecutorRouteAuditEvent(input, options);
  const safeId = event.runtimeCorrelationId.replace(/[^A-Za-z0-9._-]/g, "-");
  const artifactPath =
    options.artifactPath ||
    runtimePath(root, ["runtime", "executor-calls", `${safeId}.json`], options);
  const auditPath =
    options.auditPath || runtimePath(root, ["audit", "events.jsonl"], options);
  writeJson(artifactPath, event);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(event)}\n`);
  return { ...event, artifactPath, auditPath };
}
```

**Apply to Phase 5:** build `.claude/advisor-mode/audit-log.js` raw `audit/events.jsonl` appenders plus task/session correlated views, then wire existing producers (`executor-route-audit.js`, `provider-routing.js`, `final-review.js`, `advisor-gate.js`, and `advisor-final-review-gate.js`) through the shared helper. Keep both `taskId` and `sessionId` when present; degrade like `runtimeCorrelationId()` when one key is unavailable.

---

### `.claude/advisor-mode/budget-state.js` (service/utility, file-I/O + request-response)

**Analog:** `.claude/hooks/advisor-gate.js`

**Imports/config/state pattern** (lines 0-19, 74-83):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { runtimePath } = require("../advisor-mode/runtime-paths.js");

function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}
```

**Policy loading and required section validation** (lines 101-115):

```javascript
function loadPolicy(options = {}) {
  const root = getRoot(options);
  const policyPath =
    options.policyPath ||
    path.join(root, ".claude", "advisor-mode", "policy.example.json");
  const policy =
    options.policy || JSON.parse(fs.readFileSync(policyPath, "utf8"));
  if (!policy.advisorMode || !policy.advisorMode.gates) {
    throw new Error("advisorMode.gates policy is required");
  }
  return policy;
}

function requirePolicySection(policy, section) {
  const gates = policy && policy.advisorMode && policy.advisorMode.gates;
  if (!gates || !gates[section])
    throw new Error(`${section} policy is required`);
  return gates[section];
}
```

**Runtime state read pattern** (lines 86-99):

```javascript
function readPersistedFailureCount(
  rawEvent = {},
  event = buildGateEvent(rawEvent),
  options = {},
) {
  if (!event || event.failOpen) return { count: 0 };
  const root = getRoot(options);
  const statePath =
    options.failureStatePath ||
    runtimePath(root, DEFAULT_FAILURE_STATE_FILE, options);
  const signature = normalizeFailureSignature({
    ...rawEvent,
    toolName: event.toolName,
    toolInput: event.toolInput,
    taskState: event.taskState,
  });
  const state = readJson(statePath, { signatures: {} });
  const count = Number(
    state.signatures &&
      state.signatures[signature] &&
      state.signatures[signature].count
      ? state.signatures[signature].count
      : 0,
  );
  return { count, signature, statePath };
}
```

**Apply to Phase 5:** create `.claude/advisor-mode/budget-state.js` state under `runtimePath(root, ['state', ...])`, read caps from policy, account advisor calls/tokens/latency by task or session key across PreToolUse and final-review advisor usage paths, and return explicit reason codes for cap breaches.

---

### `.claude/advisor-mode/operator-recovery.js` (service/utility, file-I/O + request-response)

**Analog:** `.claude/hooks/advisor-gate.js` and `.claude/advisor-mode/policy.example.json`

**Mode switch pattern from hook config** (advisor-gate.js lines 56-72):

```javascript
function readAdvisorHookConfig(rootDir) {
  try {
    const configPath = path.join(rootDir, ".planning", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
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
```

**Advisory/warning-only result pattern** (advisor-gate.js lines 396-408):

```javascript
function advisoryOnlyResult(base, reason, additionalContext) {
  return {
    ...base,
    gateAction: "advisory",
    advisoryOnly: true,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: additionalContext || reason,
      },
    },
  };
}
```

**Protected-surface config pattern** (policy.example.json lines 37-49):

```json
"protectedSurfaces": {
  "auditLabel": "protected-surface.review",
  "exceptions": [".claude/advisor-mode/README.md"],
  "classes": {
    "advisor-policy": { "prefixes": [".claude/advisor-mode"], "patterns": ["^\\.claude/advisor-mode/.*\\.json$"] },
    "advisor-hooks": { "prefixes": [".claude/hooks"] },
    "claude-settings": { "files": [".claude/settings.json"] },
    "advisor-agents": { "prefixes": [".claude/agents"] },
    "advisor-commands": { "prefixes": [".claude/commands"] },
    "provider-routes": { "files": [".claude/advisor-mode/provider-routes.example.json", ".claude/advisor-mode/provider-routes.json"], "prefixes": [".claude/advisor-mode/provider-routes"] },
    "credential-controls": { "files": [".claude/advisor-mode/credentials.example.json", ".claude/advisor-mode/credential-controls.json"], "prefixes": [".claude/advisor-mode/credential-controls"] }
  }
}
```

**Apply to Phase 5:** model `enforce`, `warning-only`, and `disabled` as explicit operator modes. Capability classes should be independent toggles, but protected surfaces must remain governed by the existing protected-surface classification.

---

### `.claude/advisor-mode/doctor.js` (service/CLI, request-response + streaming + file-I/O)

**Analog:** `.claude/advisor-mode/provider-conformance.js`

**CLI and dependency imports** (lines 0-10):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { loadRouteConfig, resolveRoute } = require("./provider-routing.js");

const DEFAULT_STATE_FILE = [".advisor", "state", "provider-conformance.json"];
const DEFAULT_AUDIT_FILE = [".advisor", "audit", "events.jsonl"];
const REQUIRED_CHECKS = [
  "base-message",
  "streaming",
  "tool-use",
  "usage-fields",
  "error-shape",
];
```

**Live gateway validation pattern** (lines 100-140):

```javascript
function createLiveGatewayClient(options = {}) {
  const env = options.env || process.env;
  const baseUrl = env.ANTHROPIC_BASE_URL;
  const token = env.ANTHROPIC_AUTH_TOKEN;
  if (!baseUrl)
    throw new Error(
      "ANTHROPIC_BASE_URL is required for live provider conformance",
    );
  if (!token)
    throw new Error(
      "ANTHROPIC_AUTH_TOKEN is required for live provider conformance",
    );
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function")
    throw new Error(
      "fetch implementation is required for live provider conformance",
    );
  const endpoint = normalizeMessagesEndpoint(baseUrl);
  const anthropicVersion = options.anthropicVersion || "2023-06-01";

  async function postMessages(body) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "anthropic-version": anthropicVersion,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await readJsonResponse(response);
      } catch {
        errorBody = {
          error: {
            type: "http_error",
            message: `provider returned HTTP ${response.status}`,
          },
        };
      }
      throw createProviderError(response, errorBody);
    }
    // ...
  }
}
```

**Check runner result pattern** (lines 217-225, 227-289):

```javascript
function pass(name, evidence) {
  return { name, status: "pass", evidence };
}

function fail(name, evidence, errorShape) {
  const result = { name, status: "fail", evidence };
  if (errorShape) result.errorShape = errorShape;
  return result;
}

async function runSingleConformanceCheck(
  checkName,
  route,
  client,
  options = {},
) {
  if (!ALLOWED_CHECKS.has(checkName)) {
    return fail(checkName, {
      reason: `unsupported conformance check: ${checkName}`,
    });
  }
  if (!client || typeof client !== "object") {
    return fail(checkName, { reason: "client is required" });
  }

  try {
    // per-check body
  } catch (error) {
    return fail(
      checkName,
      { reason: error.message || "check failed" },
      sanitizeError(error),
    );
  }

  return fail(checkName, {
    reason: `unsupported conformance check: ${checkName}`,
  });
}
```

**Artifact validation/write + CLI exit pattern** (lines 489-500, 532-543):

```javascript
function writeConformanceArtifacts(artifact, options = {}) {
  const root = getRoot(options);
  const statePath = options.statePath || path.join(root, ...DEFAULT_STATE_FILE);
  const auditPath = options.auditPath || path.join(root, ...DEFAULT_AUDIT_FILE);
  const validation = validateConformanceArtifact(artifact);
  if (!validation.ok) {
    throw new Error(
      `invalid conformance artifact: ${validation.errors.join("; ")}`,
    );
  }
  writeJson(statePath, artifact);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(
    auditPath,
    `${JSON.stringify(buildAuditEvent(artifact))}\n`,
  );
  return { statePath, auditPath };
}

async function main() {
  try {
    const { input, options } = parseArgs(process.argv.slice(2));
    const result = await runConformance(input, options);
    const artifact = buildConformanceArtifact(result);
    writeConformanceArtifacts(artifact, options);
    process.stdout.write(
      `${JSON.stringify({ event: artifact.event, status: artifact.status, routes: artifact.routes.length })}\n`,
    );
    process.exitCode = artifact.status === "pass" ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
```

**Apply to Phase 5:** `doctor.js` should aggregate static checks (install, hook wiring, advisor permissions, runtime paths, active recovery/budget config) and smoke checks (provider conformance via `runConformance`). Return operator-facing pass/fail checks with repair guidance and write state + append audit.

---

### `.claude/hooks/advisor-gate.js` (middleware/hook, request-response + file-I/O)

**Analog:** self, plus budget/recovery helpers above.

**Main gate evaluation pattern** (lines 568-599):

```javascript
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
```

**Critical human approval remains hard in strict mode** (lines 601-657):

```javascript
if (rule.gateAction === "human-approval") {
  const decisionPacket = buildDecisionPacket(/* ... */);
  if (decisionPacket.gateAction === "hard-stop") return decisionPacket;
  if (decisionPacket.workflowGateStatus === "blocked-pending-advisor") {
    return strictMode
      ? {
          ...decisionPacket,
          gateAction: "block",
          policyRuleId: rule.id,
          actionClass: classes.actionClass,
          hookOutput: buildDecision(
            "deny",
            "Advisor consultation is required before this critical workflow path proceeds. Retry only after the recommendation artifact exists and validates.",
            `Advisor request: ${paths.requestPath}\nAdvisor recommendation: ${paths.recommendationPath}\n${decisionPacket.advisorProducer.instruction}`,
          ),
        }
      : advisoryOnlyResult(/* ... */);
  }
  const reentry = evaluateHumanGateReentry(decisionPacket, options);
  if (reentry.workflowGateStatus === "satisfied") {
    return {
      ...decisionPacket,
      ...reentry,
      gateAction: "allow",
      policyRuleId: rule.id,
    };
  }
  return strictMode
    ? {
        ...decisionPacket,
        ...reentry,
        gateAction: "block",
        policyRuleId: rule.id,
      }
    : advisoryOnlyResult(/* ... */);
}
```

**Apply to Phase 5:** insert budget/recovery evaluation after rule match and before advisor request creation. If over budget, degrade non-critical advisor consultation to advisory + audit. Do not degrade `human-approval` rules or final review preservation.

---

### `.claude/hooks/advisor-final-review-gate.js` (middleware/hook, request-response + file-I/O)

**Analog:** self.

**Stop hook imports and config pattern** (lines 0-31):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const {
  isFinalReviewFresh,
  validateVerdict,
  validateVerificationEvidence,
  validateExecutorDecision,
} = require("../advisor-mode/final-review.js");
const { runtimePath } = require("../advisor-mode/runtime-paths.js");
```

**Block/advisory/allow response pattern** (lines 52-96):

```javascript
function advisoryOnly(reasonCode, message, extra = {}) {
  return {
    gateAction: "advisory",
    advisoryOnly: true,
    reasonCode,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: message,
      },
    },
    ...extra,
  };
}

function block(reasonCode, message, extra = {}) {
  return {
    gateAction: "block",
    reasonCode,
    hookOutput: {
      hookSpecificOutput: {
        hookEventName: "Stop",
        permissionDecision: "deny",
        permissionDecisionReason: message,
        additionalContext:
          "Advisor Mode final review required: build a minimized context packet, obtain a fresh advisor final review verdict, record verification evidence, and record executor decisions for CONCERNS/FAIL/BLOCKED verdicts.",
      },
    },
    ...extra,
  };
}
```

**Final review validation chain** (lines 109-183):

```javascript
function evaluateFinalReviewGate(event = {}, options = {}) {
  const root = getRoot(options);
  if (!isAdvisorModeEnabled(root))
    return { gateAction: "none", reasonCode: "advisor-mode-disabled" };
  const strictMode = isAdvisorModeStrict(root);
  if (!isExplicitNonTrivialCompletion(event))
    return {
      gateAction: "none",
      reasonCode: "not-explicit-non-trivial-completion",
    };

  const freshnessInput = buildFreshnessInput(event);
  const freshness = isFinalReviewFresh(freshnessInput, { root });
  if (!freshness.fresh) {
    return strictMode ? block(/* ... */) : advisoryOnly(/* ... */);
  }
  // read verdict, evidence, optional executor decision, then allow
}
```

**Apply to Phase 5:** degraded mode must still preserve this gate. Only global disabled/kill-switch should bypass advisor mode; warning-only may advisory, but Phase 5 decisions require final review gate remains mandatory during over-limit degraded mode.

---

### `.claude/advisor-mode/runtime-paths.js` (utility, file-I/O)

**Analog:** self.

**Central runtime root/path helper** (lines 0-21):

```javascript
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");

function projectKey(rootDir) {
  return crypto
    .createHash("sha256")
    .update(path.resolve(rootDir))
    .digest("hex")
    .slice(0, 16);
}

function getAdvisorRuntimeRoot(rootDir, options = {}) {
  if (options.runtimeRoot) return options.runtimeRoot;
  if (process.env.ADVISOR_MODE_RUNTIME_ROOT)
    return process.env.ADVISOR_MODE_RUNTIME_ROOT;
  return path.join(
    os.homedir(),
    ".claude",
    "advisor-mode",
    "runtime",
    projectKey(rootDir),
  );
}

function runtimePath(rootDir, segments = [], options = {}) {
  return path.join(getAdvisorRuntimeRoot(rootDir, options), ...segments);
}
```

**Apply to Phase 5:** do not write new runtime artifacts into planning docs. Use this helper for audit indexes, budget state, recovery state, and doctor state unless intentionally writing user-facing local `.advisor` compatibility artifacts.

---

### `.claude/advisor-mode/policy.example.json` (config, request-response)

**Analog:** self.

**Runtime audit/state config shape** (lines 6-10):

```json
"runtime": {
  "auditPattern": ".advisor/audit/*.jsonl",
  "auditTarget": ".advisor/audit/events.jsonl",
  "statePattern": ".advisor/state/*.json"
}
```

**Gate policy shape** (lines 18-31, 50-80):

```json
"gates": {
  "failureThreshold": 2,
  "toolClasses": {
    "command": { "tools": ["Bash"] },
    "mutation": { "tools": ["Edit", "Write", "MultiEdit"] }
  },
  "actionClasses": {
    "destructive": { "commandPatterns": ["\\brm\\s+-rf\\b", "\\bgit\\s+push\\s+(?:[^\\n;&|]*\\s)?(?:--force|-f)\\b", "\\bgit\\s+reset\\s+--hard\\b", "\\bgit\\s+clean\\b"] },
    "force-push": { "commandPatterns": ["\\bgit\\s+push\\s+(?:[^\\n;&|]*\\s)?(?:--force|-f)\\b"] },
    "credential-control": { "pathPatterns": ["(^|/)\\.claude/advisor-mode/(credentials|credential-controls)(\\.example)?\\.json$", "(^|/)\\.env(\\.|$)"] },
    "production-affecting": { "commandPatterns": ["\\b(kubectl|terraform|pulumi)\\b.*\\b(production|prod)\\b", "\\bdeploy\\b.*\\b(production|prod)\\b"] },
    "security-boundary": { "pathPatterns": ["(^|/)\\.claude/(agents|hooks|settings\\.json)", "(^|/)\\.advisor/"] },
    "governance": { "pathPatterns": ["(^|/)\\.claude/advisor-mode/.*\\.json$", "(^|/)\\.planning/"] }
  }
}
```

**Apply to Phase 5:** add budget caps and recovery modes under `advisorMode` using the same explicit JSON object style. Avoid secrets. Include call/token/latency caps scoped by task/session and per-cap over-limit behavior.

---

### `.claude/advisor-mode/*.schema.json` for audit/budget/doctor/recovery (model/config, transform + file-I/O)

**Analog:** `.claude/advisor-mode/provider-conformance.js` validation logic and schema files.

**Schema-load plus allowlist validation pattern** (provider-conformance.js lines 426-469):

```javascript
function validateConformanceArtifact(artifact) {
  const errors = [];
  JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  if (!isPlainObject(artifact))
    return { ok: false, errors: ["artifact must be an object"] };
  const allowedTop = new Set([
    "artifact_type",
    "event",
    "checked_at",
    "status",
    "routes",
  ]);
  const allowedServed = new Set([
    "observed",
    "provider",
    "model",
    "reasonCode",
  ]);
  Object.keys(artifact).forEach((key) => {
    if (!allowedTop.has(key)) errors.push(`unexpected field: ${key}`);
  });
  if (artifact.artifact_type !== "provider-conformance")
    errors.push("artifact_type must be provider-conformance");
  if (artifact.event !== "provider_conformance.completed")
    errors.push("event must be provider_conformance.completed");
  if (!["pass", "fail"].includes(artifact.status))
    errors.push("status must be pass or fail");
  if (
    typeof artifact.checked_at !== "string" ||
    artifact.checked_at.length === 0
  )
    errors.push("checked_at is required");
  // nested validation follows
  return { ok: errors.length === 0, errors };
}
```

**Apply to Phase 5:** every artifact builder should have explicit artifact type/event/status and a validator that rejects unexpected top-level fields where governance-sensitive.

---

### `.claude/settings.json` (config, event-driven)

**Analog:** tests asserting hook wiring.

**Settings hook assertion pattern** (`failure-and-human-gates.test.js` lines 89-93, 474-483):

```javascript
function allHookCommands(settings, eventName) {
  return (settings.hooks[eventName] || []).flatMap((entry) =>
    (entry.hooks || []).map((hook) => ({
      matcher: entry.matcher || "",
      command: hook.command || "",
    })),
  );
}

test("settings wires one failure tracker PostToolUse command and preserves existing hooks", () => {
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const postToolCommands = allHookCommands(settings, "PostToolUse");
  const failureTrackerCommands = postToolCommands.filter(({ command }) =>
    command.includes("advisor-failure-tracker.js"),
  );

  assert.equal(failureTrackerCommands.length, 1);
  assert.equal(
    failureTrackerCommands[0].matcher,
    "Bash|Edit|Write|MultiEdit|Agent|Task",
  );
  assert.equal(
    postToolCommands.some(({ command }) =>
      command.includes("gsd-context-monitor.js"),
    ),
    true,
  );
  assert.equal(
    postToolCommands.some(({ command }) =>
      command.includes("advisor-install-audit.js"),
    ),
    true,
  );
});
```

**Apply to Phase 5:** if adding doctor/budget/audit hooks, assert exactly one hook command and preserve existing hook commands.

---

### `.claude/advisor-mode/tests/audit-log.test.js`, `.claude/advisor-mode/tests/budget-state.test.js`, and `.claude/advisor-mode/tests/rollback.test.js` (test, file-I/O + request-response)

**Analog:** `.claude/advisor-mode/tests/failure-and-human-gates.test.js`

**Temp runtime setup pattern** (lines 18-31):

```javascript
function makeTempRoot(
  prefix = "advisor-human-gate-",
  hooks = { advisor_mode: true, advisor_mode_strict: true },
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, ".advisor", "state"), { recursive: true });
  fs.mkdirSync(path.join(root, ".advisor", "audit"), { recursive: true });
  fs.mkdirSync(path.join(root, ".advisor", "consultations", "requests"), {
    recursive: true,
  });
  fs.mkdirSync(
    path.join(root, ".advisor", "consultations", "recommendations"),
    { recursive: true },
  );
  fs.mkdirSync(path.join(root, ".advisor", "decisions", "dispositions"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, ".planning"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".planning", "config.json"),
    JSON.stringify({ hooks }, null, 2) + "\n",
  );
  return root;
}
```

**Runtime artifact assertions** (lines 104-123):

```javascript
test("two identical normalized failures escalate at threshold 2 and require advisor disposition", () => {
  const root = makeTempRoot("advisor-failure-threshold-");
  const first = failureTracker.trackFailure(failurePayload(), { root });
  const second = failureTracker.trackFailure(failurePayload(), { root });

  assert.equal(first.count, 1);
  assert.equal(first.requiresAdvisorConsultation, false);
  assert.equal(second.count, 2);
  assert.equal(second.event, "advisor_consultation.required");
  assert.equal(second.requiresAdvisorConsultation, true);
  assert.equal(second.workflowGateStatus, "blocked-pending-advisor");

  const state = JSON.parse(
    fs.readFileSync(
      runtimePath(root, ["state", "failure-signatures.json"]),
      "utf8",
    ),
  );
  assert.equal(state.signatures[second.signature].count, 2);
  assert.equal(
    fs.existsSync(runtimePath(root, ["audit", "events.jsonl"])),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(root, ".planning", "failure-signatures.json")),
    false,
  );
});
```

**Soft/warning-only mode assertion pattern** (lines 211-226):

```javascript
test("soft mode returns advisory instead of block for critical human approval paths", () => {
  const root = makeTempRoot("advisor-soft-human-", {
    advisor_mode: true,
    advisor_mode_strict: false,
  });
  const event = {
    toolName: "Bash",
    toolInput: { command: "git push --force origin main" },
    taskState: "implementation",
  };
  const first = gate.evaluateGatePolicy(event, { root, policy });
  // ...
  const packet = gate.evaluateGatePolicy(event, { root, policy });

  assert.equal(packet.gateAction, "advisory");
  assert.equal(packet.advisoryOnly, true);
  assert.equal(packet.workflowGateStatus, "advisory-pending-human");
  assert.equal(
    packet.hookOutput.hookSpecificOutput.permissionDecision,
    undefined,
  );
});
```

**Apply to Phase 5:** tests should cover raw audit append, task/session correlated views, call/token/latency caps, degraded mode, final-review/critical-human gates preserved, mode switch, and kill-switch behavior.

---

### `.claude/advisor-mode/tests/doctor.test.js` (test, request-response + file-I/O)

**Analog:** `.claude/advisor-mode/tests/provider-conformance.test.js`

**Imports and CLI path pattern** (lines 0-18):

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const conformancePath = path.join(
  repoRoot,
  ".claude/advisor-mode/provider-conformance.js",
);
const routeExamplePath = path.join(
  repoRoot,
  ".claude/advisor-mode/provider-routes.example.json",
);
```

**Mock live client/fetch pattern** (lines 76-100):

```javascript
function createLiveFetchRecorder(options = {}) {
  const calls = [];
  const servedModel = options.servedModel || "provider/served-model";
  const fetchImpl = async (url, request = {}) => {
    const parsedBody = JSON.parse(request.body || "{}");
    calls.push({ url, request, body: parsedBody });
    if (parsedBody.stream) {
      return createStreamingResponse([
        {
          type: "message_start",
          message: { id: "msg_stream", model: servedModel },
        },
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "ok" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 1 },
        },
        { type: "message_stop" },
      ]);
    }
    // ...
  };
  return { calls, fetchImpl };
}
```

**Secret redaction assertion pattern** (lines 102-110):

```javascript
function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]/i);
  assert.doesNotMatch(serialized, /bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(serialized, /authorization/i);
  assert.doesNotMatch(serialized, /headers/i);
  assert.doesNotMatch(serialized, /requestBody|body|prompt|messages/i);
  assert.doesNotMatch(serialized, /TOKEN_PLACEHOLDER/);
}
```

**CLI failure/success assertion pattern** (lines 196-225, 292-307):

```javascript
test("ROUT-03 live CLI fails closed when gateway returns malformed Anthropic response shape", () => {
  const root = makeTempRoot();
  const fetchMockPath = path.join(root, "malformed-live-fetch.js");
  fs.writeFileSync(fetchMockPath, `...`);

  const cli = spawnSync(
    process.execPath,
    [
      "--require",
      fetchMockPath,
      conformancePath,
      "--root",
      root,
      "--alias",
      "opus",
      "--live",
    ],
    {
      encoding: "utf8",
      timeout: 2000,
      env: {
        ...process.env,
        ANTHROPIC_BASE_URL: "https://gateway.example/api",
        ANTHROPIC_AUTH_TOKEN: "TEST_TOKEN_PLACEHOLDER",
      },
    },
  );

  assert.notEqual(cli.status, 0);
  assert.doesNotMatch(cli.stdout, /TEST_TOKEN_PLACEHOLDER/);
  assert.doesNotMatch(cli.stderr, /TEST_TOKEN_PLACEHOLDER/);
  assertNoSecrets(
    readJson(path.join(root, ".advisor/state/provider-conformance.json")),
  );
});
```

**Apply to Phase 5:** doctor tests should assert operator-facing check IDs, pass/fail status, repair guidance, no secret leakage, append-only audit write, state artifact write, and optional live smoke checks.

## Shared Patterns

### Runtime paths and local artifacts

**Source:** `.claude/advisor-mode/runtime-paths.js` lines 8-16  
**Apply to:** audit, budget, recovery, doctor, hook integrations

```javascript
function getAdvisorRuntimeRoot(rootDir, options = {}) {
  if (options.runtimeRoot) return options.runtimeRoot;
  if (process.env.ADVISOR_MODE_RUNTIME_ROOT)
    return process.env.ADVISOR_MODE_RUNTIME_ROOT;
  return path.join(
    os.homedir(),
    ".claude",
    "advisor-mode",
    "runtime",
    projectKey(rootDir),
  );
}

function runtimePath(rootDir, segments = [], options = {}) {
  return path.join(getAdvisorRuntimeRoot(rootDir, options), ...segments);
}
```

### Append-only audit writes

**Source:** `.claude/hooks/executor-route-audit.js` lines 89-99 and `.claude/advisor-mode/provider-conformance.js` lines 489-500  
**Apply to:** raw audit stream, doctor events, budget/degraded transitions, recovery mode changes

```javascript
const auditPath =
  options.auditPath || runtimePath(root, ["audit", "events.jsonl"], options);
writeJson(artifactPath, event);
fs.mkdirSync(path.dirname(auditPath), { recursive: true });
fs.appendFileSync(auditPath, `${JSON.stringify(event)}\n`);
```

### Hook decision response shape

**Source:** `.claude/hooks/advisor-gate.js` lines 410-420  
**Apply to:** advisor-gate budget degradation and recovery controls

```javascript
function buildDecision(permissionDecision, reason, additionalContext) {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision,
      permissionDecisionReason: reason,
    },
  };
  if (additionalContext)
    output.hookSpecificOutput.additionalContext = additionalContext;
  return output;
}
```

### Graceful advisory/warning-only downgrade

**Source:** `.claude/hooks/advisor-gate.js` lines 396-408 and `.claude/hooks/advisor-final-review-gate.js` lines 52-65  
**Apply to:** over-limit non-critical advisor paths and operator warning-only mode

```javascript
return {
  ...base,
  gateAction: "advisory",
  advisoryOnly: true,
  hookOutput: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: additionalContext || reason,
    },
  },
};
```

### Fail-closed for invalid governance artifacts

**Source:** `.claude/hooks/advisor-gate.js` lines 557-566 and provider-conformance.js lines 489-496  
**Apply to:** malformed policy, budget state corruption, recovery config corruption, doctor artifact validation

```javascript
function hardStop(reasonCode, message) {
  return {
    gateAction: "hard-stop",
    workflowGateStatus: "hard-stop",
    retryRequired: false,
    reentryAllowed: false,
    reasonCode,
    hookOutput: buildDecision(
      "deny",
      message,
      `Advisor Mode hard stop: ${reasonCode}`,
    ),
  };
}
```

### No secret leakage in operator artifacts

**Source:** `.claude/advisor-mode/tests/provider-conformance.test.js` lines 102-110  
**Apply to:** doctor output, audit events, budget state, recovery events

```javascript
function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]/i);
  assert.doesNotMatch(serialized, /bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(serialized, /authorization/i);
  assert.doesNotMatch(serialized, /headers/i);
  assert.doesNotMatch(serialized, /requestBody|body|prompt|messages/i);
  assert.doesNotMatch(serialized, /TOKEN_PLACEHOLDER/);
}
```

## No Analog Found

None. All inferred Phase 5 files have close analogs in current runtime, hook, config, or test code.

## Metadata

**Analog search scope:** `.claude/advisor-mode/`, `.claude/hooks/`, `.claude/advisor-mode/tests/`, `.claude/settings.json`  
**Files scanned:** 86 source/planning/runtime files counted in worktree; focused reads from 7 analog files  
**Pattern extraction date:** 2026-05-29
