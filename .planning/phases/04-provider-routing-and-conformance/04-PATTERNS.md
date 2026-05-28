# Phase 04: provider-routing-and-conformance - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 8 planned new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File                                         | Role    | Data Flow        | Closest Analog                                         | Match Quality     |
| --------------------------------------------------------- | ------- | ---------------- | ------------------------------------------------------ | ----------------- |
| `.claude/advisor-mode/provider-routes.example.json`       | config  | request-response | `.claude/advisor-mode/policy.example.json`             | role-match        |
| `.claude/advisor-mode/provider-routes.schema.json`        | config  | transform        | `.claude/advisor-mode/gate-event.schema.json`          | exact             |
| `.claude/advisor-mode/provider-conformance.schema.json`   | config  | batch            | `.claude/advisor-mode/gate-event.schema.json`          | role-match        |
| `.claude/advisor-mode/provider-routing.js`                | utility | transform        | `.claude/advisor-mode/final-review.js`                 | exact             |
| `.claude/advisor-mode/provider-conformance.js`            | utility | request-response | `.claude/hooks/advisor-failure-tracker.js`             | role-match        |
| `.claude/advisor-mode/tests/provider-routing.test.js`     | test    | transform        | `.claude/advisor-mode/tests/protected-surface.test.js` | exact             |
| `.claude/advisor-mode/tests/provider-conformance.test.js` | test    | request-response | `.claude/advisor-mode/tests/final-review-gate.test.js` | role-match        |
| `.claude/advisor-mode/README.md`                          | config  | batch            | `.claude/advisor-mode/README.md`                       | exact-self-update |

## Pattern Assignments

### `.claude/advisor-mode/provider-routes.example.json` (config, request-response)

**Analog:** `.claude/advisor-mode/policy.example.json`

**Versioned config envelope** (lines 0-10):

```json
{
  "schemaVersion": 1,
  "advisorMode": {
    "enabled": true,
    "advisorAgent": "advisor-reviewer",
    "executorAuthority": "executor-only",
    "runtime": {
      "auditPattern": ".advisor/audit/*.jsonl",
      "auditTarget": ".advisor/audit/events.jsonl",
      "statePattern": ".advisor/state/*.json"
    }
```

**Provider-route protected surface seed** (lines 37-47):

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
```

**Apply:** Keep provider-route examples declarative and versioned. Store provider/model/endpoint refs and credential env var names only; do not store secrets. Preserve existing `provider-routes` protected-surface paths instead of introducing a second governance path.

---

### `.claude/advisor-mode/provider-routes.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/gate-event.schema.json`

**Strict JSON Schema pattern** (lines 0-5):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Advisor Mode Gate Event",
  "type": "object",
  "additionalProperties": false,
  "required": ["correlationKey", "event", "triggerReason", "workflowGateStatus", "retryRequired"],
```

**Enum and property style** (lines 8-28):

```json
"event": {
  "type": "string",
  "enum": [
    "advisor_consultation.required",
    "advisor_failure.observed",
    "human_approval.required",
    "human_approval.disposition"
  ]
},
"triggerReason": { "type": "string", "minLength": 1 },
"workflowGateStatus": {
  "type": "string",
  "enum": ["observed", "blocked-pending-advisor", "blocked-pending-human", "satisfied", "hard-stop"]
},
"retryRequired": { "type": "boolean" },
"requiresAdvisorConsultation": { "type": "boolean" },
"requiresAdvisorDisposition": { "type": "boolean" },
"reentryAllowed": { "type": "boolean" },
"dispositionPath": { "type": "string" },
"requestPath": { "type": "string" },
"recommendationPath": { "type": "string" }
```

**Apply:** Create a strict draft-2020-12 schema with `schemaVersion`, `routes`, and route objects requiring `provider`, `model`, and non-secret endpoint/credential references. Use enums for conformance names such as `base-message`, `streaming`, `tool-use`, `usage-fields`, `error-shape`.

---

### `.claude/advisor-mode/provider-conformance.schema.json` (config, batch)

**Analog:** `.claude/advisor-mode/gate-event.schema.json`

**Strict artifact contract** (lines 0-5):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Advisor Mode Gate Event",
  "type": "object",
  "additionalProperties": false,
  "required": ["correlationKey", "event", "triggerReason", "workflowGateStatus", "retryRequired"],
```

**Apply:** Mirror strict schema style for conformance results: top-level `artifact_type`, `checked_at`, `status`, `routes`, and per-check results. Prefer `additionalProperties: false` so audit artifacts remain deterministic.

---

### `.claude/advisor-mode/provider-routing.js` (utility, transform)

**Analog:** `.claude/advisor-mode/final-review.js`

**Imports and local schema constants** (lines 0-8):

```javascript
const fs = require("node:fs");
const path = require("node:path");

const VERDICT_SCHEMA_PATH = path.join(__dirname, "verdict.schema.json");
const VALID_VERDICT_VALUES = {
  status: new Set(["PASS", "CONCERNS", "FAIL", "BLOCKED"]),
  risk: new Set(["low", "medium", "high", "critical"]),
  confidence: new Set(["low", "medium", "high"]),
};
```

**Pure transform builder pattern** (lines 46-69):

```javascript
function buildContextPacket(input = {}) {
  const packet = {
    packet_type: "advisor-final-review-context",
    changed_files: copyArray(input.changed_files),
    relevant_diff_excerpts: copyArray(input.relevant_diff_excerpts),
    relevant_errors: copyArray(input.relevant_errors),
    explicit_questions: copyArray(input.explicit_questions),
    created_at: input.created_at || new Date().toISOString(),
  };

  if (
    typeof input.correlationKey === "string" &&
    input.correlationKey.length > 0
  ) {
    packet.correlationKey = input.correlationKey;
  }
  if (typeof input.task_summary === "string") {
    packet.task_summary = input.task_summary;
  }

  const verificationSummary = copyObject(input.verification_summary);
  if (verificationSummary) {
    packet.verification_summary = verificationSummary;
  }

  return packet;
}
```

**Manual validation with explicit errors** (lines 71-147):

```javascript
function validateContextPacket(packet) {
  const schema = readContextSchema();
  const errors = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return { ok: false, errors: ["packet must be an object"] };
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

  return { ok: errors.length === 0, errors };
}
```

**Runtime artifact write helper** (lines 359-362):

```javascript
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
```

**Module exports** (lines 612-623):

```javascript
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
};
```

**Apply:** Implement route resolver as pure CommonJS functions: load/validate config, resolve alias to provider/model/metadata, sanitize output, and export functions for tests. Keep workflow gate/verdict logic out of this module.

---

### `.claude/advisor-mode/provider-conformance.js` (utility, request-response)

**Analog:** `.claude/hooks/advisor-failure-tracker.js`

**Node script constants and artifact defaults** (lines 0-8):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const FAILURE_THRESHOLD = 2;
const DEFAULT_STATE_FILE = path.join(
  ".advisor",
  "state",
  "failure-signatures.json",
);
const DEFAULT_AUDIT_FILE = path.join(".advisor", "audit", "events.jsonl");
```

**Root and fallback helpers** (lines 9-24):

```javascript
function getRoot(options = {}) {
  return options.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null);
}
```

**Audit event append pattern** (lines 126-143):

```javascript
function appendAuditEvent(event, options = {}) {
  const root = getRoot(options);
  const auditPath =
    options.auditPath || event.auditPath || path.join(root, DEFAULT_AUDIT_FILE);
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
```

**CLI parse/main fail-open style for hooks/commands** (lines 164-193):

```javascript
function parseInput(input) {
  try {
    return input ? JSON.parse(input) : null;
  } catch {
    return null;
  }
}

function main() {
  let input = "";
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    try {
      const event = parseInput(input);
      const result = trackFailure(event);
      if (result.requiresAdvisorConsultation) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: JSON.stringify(result),
            },
          }),
        );
      }
    } catch {
      process.exitCode = 0;
    }
  });
}

if (require.main === module) main();
```

**Apply:** Conformance command should be testable through exported functions and runnable as a local Node command. Use bounded checks, sanitized artifacts, `.advisor/state/provider-conformance.json`, and append audit lines to `.advisor/audit/events.jsonl`. Do not log headers/tokens/request bodies containing secrets.

---

### `.claude/advisor-mode/tests/provider-routing.test.js` (test, transform)

**Analog:** `.claude/advisor-mode/tests/protected-surface.test.js`

**Native node:test imports and repo-root fixture pattern** (lines 0-16):

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  classifyPathClass,
  evaluateGatePolicy,
  buildDecisionPacket,
  evaluateHumanGateReentry,
  writeDisposition,
} = require("../../hooks/advisor-gate.js");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const policy = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, ".claude/advisor-mode/policy.example.json"),
    "utf8",
  ),
);
```

**Temporary root helper** (lines 17-19):

```javascript
function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "advisor-mode-protected-"));
}
```

**Policy-driven provider-route assertion** (lines 50-65):

```javascript
test("policy classifies every D-14 protected surface from policy data", () => {
  const cases = [
    [".claude/advisor-mode/policy.example.json", "advisor-policy"],
    [".claude/advisor-mode/verdict.schema.json", "advisor-policy"],
    [".claude/hooks/advisor-gate.js", "advisor-hooks"],
    [".claude/settings.json", "claude-settings"],
    [".claude/agents/advisor-reviewer.md", "advisor-agents"],
    [".claude/commands/advisor-mode.md", "advisor-commands"],
    [".claude/advisor-mode/provider-routes.example.json", "provider-routes"],
    [".claude/advisor-mode/credentials.example.json", "credential-controls"],
  ];

  for (const [filePath, expectedClass] of cases) {
    assert.equal(
      classifyPathClass("Edit", { file_path: filePath }, policy),
      expectedClass,
      filePath,
    );
  }
});
```

**Apply:** Test route schema strictness, alias resolution, missing/invalid routes, protected-surface classification for provider route files, and audit-safe resolved metadata. Use temp roots for artifact tests.

---

### `.claude/advisor-mode/tests/provider-conformance.test.js` (test, request-response)

**Analog:** `.claude/advisor-mode/tests/final-review-gate.test.js`

**Test imports and module path pattern** (lines 0-12):

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const advisorModeRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(advisorModeRoot, "..", "..");
const finalReview = require("../final-review.js");
const finalReviewGatePath = path.join(
  projectRoot,
  ".claude",
  "hooks",
  "advisor-final-review-gate.js",
);
const { evaluateFinalReviewGate } = require(finalReviewGatePath);
```

**Artifact writer helper** (lines 17-20):

```javascript
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
```

**CLI spawn pattern** (lines 121-130):

```javascript
function runFinalReviewGate(input, options = {}) {
  return spawnSync(process.execPath, [finalReviewGatePath], {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      ADVISOR_FINAL_REVIEW_GATE_STDIN_TIMEOUT_MS: String(
        options.stdinTimeoutMs || 100,
      ),
    },
    timeout: options.processTimeoutMs || 1000,
  });
}
```

**Fail-closed/invalid input test style** (lines 140-146):

```javascript
test("Stop hook CLI fails closed on empty stdin", () => {
  assertBlockingHookOutput(runFinalReviewGate(""));
});

test("Stop hook CLI fails closed on malformed stdin", () => {
  assertBlockingHookOutput(runFinalReviewGate("{not-json"));
});
```

**Apply:** Use mocked client/fetch for deterministic base-message, streaming, tool-use, usage-fields, and error-shape checks. Add CLI tests for malformed config/input and artifact-write tests for `.advisor/state/provider-conformance.json` plus `.advisor/audit/events.jsonl`.

---

### `.claude/advisor-mode/README.md` (config/docs, batch)

**Analog:** `.claude/advisor-mode/README.md`

**Validation command pattern** (lines 8-12, 73-79, 100-106):

````markdown
Validate Phase 1 local install correctness with:

```bash
node --test .claude/advisor-mode/tests/*.test.js
```
````

````

**Runtime artifact documentation pattern** (lines 63-71):

```markdown
Generated runtime artifacts stay under ignored `.advisor/` paths:

- `.advisor/consultations/requests/*.json`
- `.advisor/consultations/recommendations/*.json`
- `.advisor/decisions/dispositions/*.json`
- `.advisor/state/*.json`
- `.advisor/audit/*.jsonl`
````

**Apply:** Add a Phase 4 section documenting provider routes, conformance command, resolved provider/model audit visibility, and validation command. Keep it concise and maintain phase boundaries: routing/conformance only; budgets and rollback remain later-phase concerns.

## Shared Patterns

### CommonJS Node Runtime

**Source:** `.claude/advisor-mode/final-review.js` lines 0-2 and `.claude/hooks/advisor-failure-tracker.js` lines 0-3

```javascript
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
```

**Apply to:** `provider-routing.js`, `provider-conformance.js`, tests.

### Strict Schema Contracts

**Source:** `.claude/advisor-mode/gate-event.schema.json` lines 0-5

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Advisor Mode Gate Event",
  "type": "object",
  "additionalProperties": false,
  "required": ["correlationKey", "event", "triggerReason", "workflowGateStatus", "retryRequired"],
```

**Apply to:** `provider-routes.schema.json`, `provider-conformance.schema.json`.

### Explicit Validation Result Shape

**Source:** `.claude/advisor-mode/final-review.js` lines 71-147

```javascript
function validateContextPacket(packet) {
  const schema = readContextSchema();
  const errors = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return { ok: false, errors: ["packet must be an object"] };
  }

  return { ok: errors.length === 0, errors };
}
```

**Apply to:** Route config validation, conformance result validation, artifact validation.

### Runtime Artifact Writes

**Source:** `.claude/advisor-mode/final-review.js` lines 359-362 and `.claude/hooks/advisor-failure-tracker.js` lines 126-143

```javascript
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
```

```javascript
fs.appendFileSync(auditPath, `${JSON.stringify(concise)}\n`);
```

**Apply to:** Conformance state artifact and route/conformance audit events. Always create parent directories and write newline-terminated JSON/JSONL.

### Protected Surface Governance

**Source:** `.claude/advisor-mode/policy.example.json` lines 37-47 and `.claude/hooks/advisor-gate.js` lines 119-145

```javascript
function pathMatchesConfig(filePath, config = {}) {
  if ((config.exceptions || []).includes(filePath)) return false;
  if ((config.files || []).includes(filePath)) return true;
  if (
    (config.prefixes || []).some(
      (prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`),
    )
  )
    return true;
  return matchesAny(filePath, config.patterns || []);
}
```

**Apply to:** Provider route file governance. Do not bypass `advisor-gate.js`; ensure new route files remain covered by existing `provider-routes` protected surface.

### Test Structure

**Source:** `.claude/advisor-mode/tests/protected-surface.test.js` lines 0-16

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const policy = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, ".claude/advisor-mode/policy.example.json"),
    "utf8",
  ),
);
```

**Apply to:** Both Phase 4 test files. Use Node built-in `node:test`; no new package install required.

## No Analog Found

None. All planned files have usable analogs in the existing `.claude/advisor-mode/` and `.claude/hooks/` surfaces.

## Metadata

**Analog search scope:** `.claude/advisor-mode/`, `.claude/hooks/`, `.claude/settings.json`, `.claude/agents/`
**Files scanned:** 20+ Claude asset files listed under `.claude/`
**Skills checked:** No project skills directory found under `.claude/skills/` or `.agents/skills/`.
**Pattern extraction date:** 2026-05-28
