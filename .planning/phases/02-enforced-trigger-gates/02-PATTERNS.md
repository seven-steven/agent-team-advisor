# Phase 2: Enforced Trigger Gates - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 17
**Analogs found:** 17 / 17

## File Classification

| Planned File                                                 | Role       | Data Flow        | Closest Analog                                       | Shared Pattern Reference                                     | Match Quality  |
| ------------------------------------------------------------ | ---------- | ---------------- | ---------------------------------------------------- | ------------------------------------------------------------ | -------------- |
| `.claude/advisor-mode/policy.example.json`                   | config     | request-response | `.claude/advisor-mode/policy.example.json`           | Config shape pattern; policy data lives under `advisorMode`  | exact-existing |
| `.claude/settings.json`                                      | config     | event-driven     | `.claude/settings.json`                              | Settings are the only hook wiring seam                       | exact-existing |
| `.claude/hooks/advisor-gate.js`                              | middleware | event-driven     | `.claude/hooks/advisor-boundary-check.js`            | CommonJS hook exports; narrow fail-open / hard-stop contract | exact-role     |
| `.claude/hooks/advisor-runtime-probe.js`                     | middleware | event-driven     | `.claude/hooks/advisor-boundary-check.js`            | Disposable PreToolUse probe; CommonJS hook output shape      | role-match     |
| `.claude/hooks/advisor-failure-tracker.js`                   | middleware | event-driven     | `.claude/hooks/advisor-install-audit.js`             | PostToolUse skeleton; runtime audit/state outside planning   | role-match     |
| `.claude/hooks/advisor-boundary-check.js`                    | middleware | event-driven     | `.claude/hooks/advisor-boundary-check.js`            | Existing advisor boundary reminder remains focused/read-only | exact-existing |
| `.claude/hooks/advisor-install-audit.js`                     | middleware | event-driven     | `.claude/hooks/advisor-install-audit.js`             | Existing PostToolUse audit reminder remains separate         | exact-existing |
| `.claude/advisor-mode/advisor-request.schema.json`           | config     | transform        | `.claude/advisor-mode/verdict.schema.json`           | Draft 2020-12 schema style with enums and required fields    | role-match     |
| `.claude/advisor-mode/advisor-recommendation.schema.json`    | config     | transform        | `.claude/advisor-mode/verdict.schema.json`           | Draft 2020-12 schema style with read-only source constraints | role-match     |
| `.claude/advisor-mode/gate-event.schema.json`                | config     | transform        | `.claude/advisor-mode/verdict.schema.json`           | Draft 2020-12 event schema style                             | role-match     |
| `.claude/advisor-mode/decision-packet.schema.json`           | config     | transform        | `.claude/advisor-mode/verdict.schema.json`           | Human packet structured contract                             | role-match     |
| `.claude/advisor-mode/disposition.schema.json`               | config     | transform        | `.claude/advisor-mode/verdict.schema.json`           | Disposition enum schema with strict required fields          | role-match     |
| `.claude/advisor-mode/tests/runtime-semantics.test.js`       | test       | state-machine    | `.claude/advisor-mode/tests/boundary.test.js`        | Node built-ins; direct module import; temp runtime fixtures  | role-match     |
| `.claude/advisor-mode/tests/advisor-consultation.test.js`    | test       | request-response | `.claude/advisor-mode/tests/init.test.js`            | Node built-ins; direct module import; settings assertions    | role-match     |
| `.claude/advisor-mode/tests/failure-and-human-gates.test.js` | test       | state-machine    | `.claude/advisor-mode/tests/boundary.test.js`        | Temp fixture and direct module import; runtime separation    | role-match     |
| `.claude/advisor-mode/tests/protected-surface.test.js`       | test       | transform        | `.claude/advisor-mode/tests/scaffold-layout.test.js` | Versioned asset inventory and path classification assertions | role-match     |
| `.claude/advisor-mode/README.md`                             | config     | file-I/O         | `.claude/advisor-mode/README.md`                     | Concise operational docs plus validation command             | exact-existing |

## Pattern Assignments

### `.claude/advisor-mode/policy.example.json` (config, request-response)

**Analog:** `.claude/advisor-mode/policy.example.json`

**Config shape pattern:** preserve the existing top-level `schemaVersion` and `advisorMode` object. Add gate policy keys under `advisorMode.gates`, not as sibling top-level config.

**Planner guidance:** Add `failureThreshold: 2`, `toolClasses`, `actionClasses`, `pathClasses`, `protectedSurfaces`, `rules`, audit labels, and gate actions inside `advisorMode`. Preserve Phase 1 `runtime.auditTarget`, `runtime.statePattern`, and `auditEvents.baseline`.

---

### `.claude/settings.json` (config, event-driven)

**Analog:** `.claude/settings.json`

**Hook registration pattern:** central hook configuration contains `PreToolUse` and `PostToolUse` arrays with command entries using `"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/{hook}.js`.

**Planner guidance:** Register new Phase 2 hooks through this central settings seam. Keep `Read` outside Phase 2 gate matchers except existing injection scanning, preserving GATE-05 low-risk read behavior. Preserve existing GSD hooks plus `advisor-boundary-check.js` and `advisor-install-audit.js`.

---

### `.claude/hooks/advisor-gate.js` (middleware, event-driven)

**Analog:** `.claude/hooks/advisor-boundary-check.js`

**CommonJS hook pattern:** use Node built-ins, `#!/usr/bin/env node`, exported pure functions, `if (require.main === module) main();`, and JSON hook output through stdout.

**Planner guidance:** Implement policy loading, classification, request writing, recommendation validation, re-entry, and protected-surface evaluation here. Copy defensive parsing only for malformed host payload and missing tool name. Do not fail open for configured/gated event infrastructure failures: missing/unreadable policy, thrown classification, and required request artifact write failure return explicit blocking hard-stop output with stable reason codes. Do not hard-code protected path rules only in this hook; load them from policy data.

---

### `.claude/hooks/advisor-runtime-probe.js` (middleware, event-driven)

**Analog:** `.claude/hooks/advisor-boundary-check.js`

**Probe output pattern:** use PreToolUse hook output shape with `hookSpecificOutput.hookEventName: "PreToolUse"`, `blocking: true`, and workflow metadata.

**Planner guidance:** Keep disposable and self-contained. Export `buildBlockingProbeOutput`, `buildDispositionProbeOutput`, and `main`. Fail open on malformed probe input, but model missing disposition as `blocked-pending-human` and valid matching approve/reject/revise/defer disposition as `satisfied`.

---

### `.claude/hooks/advisor-failure-tracker.js` (middleware, event-driven)

**Analog:** `.claude/hooks/advisor-install-audit.js`

**PostToolUse hook skeleton:** parse stdin defensively, emit `hookSpecificOutput.hookEventName: "PostToolUse"`, and use ignored runtime state/audit paths.

**Planner guidance:** Preserve fail-open behavior for malformed PostToolUse input. Parse `tool_name`, `toolName`, `tool_response`, `toolResponse`, `exit_code`, `exitCode`, `stderr`, `stdout`, `error`, and `status`. Normalize failure signatures and persist counters under `.advisor/state/failure-signatures.json`; append concise events to `.advisor/audit/events.jsonl`; never write runtime state to `.planning/`.

---

### `.claude/hooks/advisor-boundary-check.js` (middleware, event-driven)

**Analog:** `.claude/hooks/advisor-boundary-check.js`

**Boundary pattern:** this existing hook validates advisor model/tool boundaries and reminds that advisor stays read-only.

**Planner guidance:** Keep focused on read-only advisor boundary. Do not turn it into the canonical gate policy source.

---

### `.claude/hooks/advisor-install-audit.js` (middleware, event-driven)

**Analog:** `.claude/hooks/advisor-install-audit.js`

**Audit reminder pattern:** existing PostToolUse hook emits audit context and otherwise remains lightweight.

**Planner guidance:** Leave as Phase 1 baseline unless narrowly sharing an audit writer. New gate/failure event semantics live in `advisor-gate.js` and `advisor-failure-tracker.js`.

---

### `.claude/advisor-mode/advisor-request.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Schema pattern:** draft 2020-12 JSON Schema, `type: "object"`, `additionalProperties: false`, explicit `required`, enums for event/timing/risk/action fields.

**Planner guidance:** Model request artifacts with `correlationKey`, `event: "advisor_consultation.required"`, trigger/risk/tool/path/action fields, `consultationTiming: "before-proceed"`, `requestPath`, `recommendationPath`, and `advisorProducer`.

---

### `.claude/advisor-mode/advisor-recommendation.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Schema pattern:** same strict draft 2020-12 style as verdict schema.

**Planner guidance:** Require `source: "read-only-advisor"`, `advisorAgent: "advisor-reviewer"`, matching `correlationKey`, status/risk/confidence, recommendation, rationale, blocking findings, recommended actions, verification guidance, and `requestPath`.

---

### `.claude/advisor-mode/gate-event.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Schema pattern:** static schema with explicit event enum, risk enum, gate-action enum, and strict required fields.

**Planner guidance:** Cover advisor consultation, repeated failure, human approval, disposition, protected-surface, and hard-stop event variants without adding schema dependencies.

---

### `.claude/advisor-mode/decision-packet.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Schema pattern:** structured contract with `additionalProperties: false`, explicit required D-12 fields, and nested advisor recommendation object.

**Planner guidance:** Human packet requires trigger reason, decision summary, risk level, options, non-null advisor recommendation, expected consequences, suggested verification points, `correlationKey`, `workflowGateStatus: "blocked-pending-human"`, and `dispositionPath`.

---

### `.claude/advisor-mode/disposition.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Schema pattern:** strict draft 2020-12 object schema with enum constraints.

**Planner guidance:** Require `correlationKey`, `event: "human_approval.disposition"`, `disposition`, `decidedBy`, `decidedAt`, `rationale`, and `appliesTo`. Disposition enum is exactly `approve`, `reject`, `revise`, `defer`; optional `conditions` applies to revise/defer.

---

### `.claude/advisor-mode/tests/runtime-semantics.test.js` (test, state-machine)

**Analog:** `.claude/advisor-mode/tests/boundary.test.js`

**Test pattern:** Node built-ins, `node:test`, `node:assert/strict`, temp directories via `fs.mkdtempSync`, direct module import from hook file.

**Planner guidance:** Test runtime probe exports directly. Use temp `.advisor/decisions/dispositions` directories. Assert `blocked-pending-human`, no re-entry without valid disposition, and satisfied re-entry only for matching approve/reject/revise/defer.

---

### `.claude/advisor-mode/tests/advisor-consultation.test.js` (test, request-response)

**Analog:** `.claude/advisor-mode/tests/init.test.js`

**Test pattern:** Node built-ins, temp repo roots, direct module import, settings assertions, JSON fixture reads/writes.

**Planner guidance:** Test high-risk event → request artifact → advisor producer instruction → recommendation artifact → satisfied re-entry. Also test Read/low-risk no-op. Include exact fail-open/hard-stop assertions: malformed host payload and missing tool name fail open; missing/unreadable policy, classification failure, and required request artifact write failure on configured/gated events hard-stop.

---

### `.claude/advisor-mode/tests/failure-and-human-gates.test.js` (test, state-machine)

**Analog:** `.claude/advisor-mode/tests/boundary.test.js`

**Test pattern:** direct module imports and isolated temp runtime directories.

**Planner guidance:** Test repeated-failure threshold 2, failure signature normalization, human packet creation only after matching recommendation, disposition writing, disposition validation, and blocked re-entry for absent/malformed/mismatched/stale dispositions.

---

### `.claude/advisor-mode/tests/protected-surface.test.js` (test, transform)

**Analog:** `.claude/advisor-mode/tests/scaffold-layout.test.js`

**Test pattern:** versioned asset inventory, path classification assertions, and docs assertions.

**Planner guidance:** Test every D-14 protected surface class from policy data: advisor policy/schema files, hooks/settings wiring, agent/command assets, provider-route controls, and credential-control surfaces. Assert protected default review uses Plan 02 advisor chain, protected critical review uses Plan 03 human disposition chain, and audit label is `protected-surface.review`.

---

### `.claude/advisor-mode/README.md` (config, file-I/O)

**Analog:** `.claude/advisor-mode/README.md`

**Docs pattern:** concise operational section plus validation command.

**Planner guidance:** Add Phase 2 documentation covering runtime semantics gate, high-risk advisor producer chain, repeated-failure threshold 2, human approval packet/disposition artifact, re-entry validation, protected surfaces, ignored runtime artifacts, and `node --test .claude/advisor-mode/tests/*.test.js`.

## Shared Patterns

### Hook scripts fail open only for malformed host input or missing tool name

**Source:** `.claude/hooks/advisor-boundary-check.js` and `.claude/hooks/advisor-install-audit.js`
**Apply to:** `advisor-runtime-probe.js`, PostToolUse malformed input handling, and `advisor-gate.js` host-input parsing only

Malformed stdin or missing tool name means the hook cannot identify a meaningful host event. That may exit without a gate.

### Configured/gated events hard-stop on gate infrastructure failure

**Source:** Phase 2 revision contract from checker feedback
**Apply to:** `advisor-gate.js`, `advisor-consultation.test.js`, README/validation descriptions

Once a configured matcher event is identifiable, policy-load failure, classification failure, and required request artifact write failure are blocking workflow states with explicit reason codes. They are not fail-open cases.

### Advisor remains read-only; executor owns mutation

**Source:** `.claude/agents/advisor-reviewer.md` and `.claude/agents/executor-guidance.md`
**Apply to:** All gate, decision, and audit implementation tasks

Advisor uses read-only tools only. The executor triggers advisor review, persists recommendation/disposition artifacts, and retains mutation authority.

### Settings are the only hook wiring seam

**Source:** `.claude/settings.json` and `.claude/advisor-mode/init.js`
**Apply to:** Hook registration and init/scaffold updates

Update hook registration centrally. Do not add separate host permission layers for Advisor Mode.

### Runtime audit/state stays outside planning docs

**Source:** `.claude/advisor-mode/tests/scaffold-layout.test.js` and `.claude/advisor-mode/init.js`
**Apply to:** Consultation requests/recommendations, failure state, audit events, and dispositions

Runtime artifacts live under ignored `.advisor/` paths and are never committed under `.planning/`.

### Tests use Node built-ins and direct module exports

**Source:** `.claude/advisor-mode/tests/boundary.test.js`, `.claude/advisor-mode/tests/init.test.js`
**Apply to:** All new Phase 2 tests

Use `node:test`, `node:assert/strict`, `fs`, `os`, `path`, direct hook imports, and temp runtime directories. No new package dependencies.

## No Analog Found

No Phase 2 file lacks a close codebase analog. New behavior is constrained to existing project-local Claude Code asset patterns: CommonJS hooks, strict JSON schemas, Node built-in tests, central settings wiring, README docs, and ignored `.advisor/` runtime artifacts.

| File | Role | Data Flow | Reason                                              |
| ---- | ---- | --------- | --------------------------------------------------- |
| —    | —    | —         | All planned files have at least role-match analogs. |

## Metadata

**Analog search scope:** `.claude/settings.json`, `.claude/hooks/*.js`, `.claude/advisor-mode/*.json`, `.claude/advisor-mode/*.md`, `.claude/advisor-mode/tests/*.test.js`, `.claude/agents/*.md`
**Files scanned:** 17
**Strong analogs used:** 9
**Pattern extraction date:** 2026-05-21
