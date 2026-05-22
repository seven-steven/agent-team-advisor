---
phase: 02-enforced-trigger-gates
reviewed: 2026-05-22T11:47:37Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - .advisor/audit/.gitkeep
  - .advisor/decisions/dispositions/.gitkeep
  - .advisor/state/.gitkeep
  - .claude/advisor-mode/advisor-recommendation.schema.json
  - .claude/advisor-mode/advisor-request.schema.json
  - .claude/advisor-mode/decision-packet.schema.json
  - .claude/advisor-mode/disposition.schema.json
  - .claude/advisor-mode/gate-event.schema.json
  - .claude/advisor-mode/init.js
  - .claude/advisor-mode/policy.example.json
  - .claude/advisor-mode/README.md
  - .claude/advisor-mode/tests/advisor-agent.test.js
  - .claude/advisor-mode/tests/advisor-consultation.test.js
  - .claude/advisor-mode/tests/boundary.test.js
  - .claude/advisor-mode/tests/failure-and-human-gates.test.js
  - .claude/advisor-mode/tests/init.test.js
  - .claude/advisor-mode/tests/protected-surface.test.js
  - .claude/advisor-mode/tests/runtime-semantics.test.js
  - .claude/advisor-mode/tests/scaffold-layout.test.js
  - .claude/advisor-mode/verdict.schema.json
  - .claude/agents/advisor-reviewer.md
  - .claude/agents/executor-guidance.md
  - .claude/hooks/advisor-boundary-check.js
  - .claude/hooks/advisor-failure-tracker.js
  - .claude/hooks/advisor-gate.js
  - .claude/hooks/advisor-install-audit.js
  - .claude/hooks/advisor-runtime-probe.js
  - .claude/settings.json
  - CLAUDE.md
  - docs/research/claude_code_teams_advisor_research-conversation-20260519.md
  - .gitignore
  - README.md
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-22T11:47:37Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Reviewed the Phase 2 advisor-gate implementation, runtime hooks, installer, schemas, and docs. The main problems are behavioral: the human approval gate currently treats rejection/defer as authorization, the failure tracker misclassifies healthy commands as failures, and the installer still provisions the old Phase 1 scaffold instead of the new Phase 2 runtime.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Human rejection and defer dispositions still unlock the blocked action

**File:** `.claude/hooks/advisor-gate.js:419-450, 524-528`
**Issue:** `validateDisposition()` accepts all four dispositions (`approve`, `reject`, `revise`, `defer`) as equally valid, and `evaluateHumanGateReentry()` marks any valid artifact as `workflowGateStatus: 'satisfied'`. `evaluateGatePolicy()` then converts that satisfied state into `gateAction: 'allow'` without checking which disposition was chosen. In practice, a human can explicitly reject or defer a destructive/protected action and the next retry is still allowed through.
**Fix:** Only `approve` should unlock the original action. `reject` and `defer` should remain blocked, and `revise` should require a new request/correlation key before retry.

```js
function evaluateHumanGateReentry(packet = {}, options = {}) {
  const readResult = readDisposition(packet.correlationKey, {
    ...options,
    dispositionPath: options.dispositionPath || packet.dispositionPath,
  });
  const base = {
    correlationKey: packet.correlationKey,
    workflowGateStatus: "blocked-pending-human",
    retryRequired: true,
    reentryAllowed: false,
    requiresExplicitRetry: true,
    hostWaitAndResume: false,
    dispositionPath: readResult.path,
  };
  if (!readResult.ok) return { ...base, reasonCode: readResult.reasonCode };
  if (!validateDisposition(readResult.disposition, packet))
    return { ...base, reasonCode: "invalid-disposition-artifact" };

  if (readResult.disposition.disposition !== "approve") {
    return {
      ...base,
      disposition: readResult.disposition.disposition,
      reasonCode: "disposition-does-not-authorize-retry",
    };
  }

  return {
    ...base,
    workflowGateStatus: "satisfied",
    reentryAllowed: true,
    disposition: "approve",
    reasonCode: "valid-disposition",
  };
}
```

### CR-02: Failure tracker records successful commands as failures and can deadlock normal Bash usage

**File:** `.claude/hooks/advisor-failure-tracker.js:146-150, 152-162, 183-187`
**Issue:** `isFailure()` returns true whenever `getOutputText(payload)` is non-empty. For `PostToolUse`, successful Bash commands commonly produce stdout, so ordinary commands are treated as failures. When the hook payload omits an exit code, `getExitCode()` falls back to `'unknown'`, and `Number('unknown') !== 0` is also true. That combination causes repeated successful Bash invocations to increment the failure counter and emit `advisor_consultation.required` for healthy commands.
**Fix:** Treat a run as failure only when there is an explicit non-zero exit code or an explicit failed/error status. Do not infer failure from stdout/stderr text alone, and do not treat missing exit codes as failure.

```js
function isFailure(payload = {}) {
  const exitCode = getExitCode(payload);
  const status = String(
    pick(payload.status, getToolResponse(payload).status, ""),
  ).toLowerCase();

  if (exitCode !== "unknown") {
    return Number(exitCode) !== 0;
  }

  return ["failed", "failure", "error"].includes(status);
}
```

### CR-03: Installer still ships the obsolete Phase 1 scaffold, so fresh installs miss the Phase 2 gate system entirely

**File:** `.claude/advisor-mode/init.js:7-14, 15-299, 339-356`
**Issue:** The checked-in repo contains the new Phase 2 assets (`advisor-gate.js`, `advisor-failure-tracker.js`, `advisor-runtime-probe.js`, new schemas, updated ignore coverage, dispositions placeholder), but `init.js` still writes only the old Phase 1 files and only merges the boundary/audit hooks. A fresh repo initialized with this script will not install the gate hook, failure tracker hook, runtime probe, request/recommendation/disposition ignore rules, or the new schema set described in the docs.
**Fix:** Update `files`, `RUNTIME_PLACEHOLDERS`, `GITIGNORE_RULES`, and `mergeSettings()` so the installer provisions the full Phase 2 surface and hook wiring.

```js
const GATE_COMMAND =
  '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-gate.js';
const FAILURE_TRACKER_COMMAND =
  '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-failure-tracker.js';

const GITIGNORE_RULES = [
  ".advisor/audit/*.jsonl",
  "!.advisor/audit/.gitkeep",
  ".advisor/state/*.json",
  "!.advisor/state/.gitkeep",
  ".advisor/consultations/requests/*.json",
  "!.advisor/consultations/requests/.gitkeep",
  ".advisor/consultations/recommendations/*.json",
  "!.advisor/consultations/recommendations/.gitkeep",
  ".advisor/decisions/dispositions/*.json",
  "!.advisor/decisions/dispositions/.gitkeep",
];

addHook(
  settings,
  "PreToolUse",
  { matcher: "Bash|Edit|Write|MultiEdit", hooks: advisorHook(GATE_COMMAND) },
  GATE_COMMAND,
);
addHook(
  settings,
  "PostToolUse",
  {
    matcher: "Bash|Edit|Write|MultiEdit|Agent|Task",
    hooks: advisorHook(FAILURE_TRACKER_COMMAND),
  },
  FAILURE_TRACKER_COMMAND,
);
```

---

_Reviewed: 2026-05-22T11:47:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
