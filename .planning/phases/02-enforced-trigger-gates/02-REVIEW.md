---
phase: 02-enforced-trigger-gates
reviewed: 2026-05-22T04:30:11Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - .advisor/decisions/dispositions/.gitkeep
  - .claude/advisor-mode/README.md
  - .claude/advisor-mode/advisor-recommendation.schema.json
  - .claude/advisor-mode/advisor-request.schema.json
  - .claude/advisor-mode/decision-packet.schema.json
  - .claude/advisor-mode/disposition.schema.json
  - .claude/advisor-mode/gate-event.schema.json
  - .claude/advisor-mode/policy.example.json
  - .claude/advisor-mode/tests/advisor-consultation.test.js
  - .claude/advisor-mode/tests/failure-and-human-gates.test.js
  - .claude/advisor-mode/tests/protected-surface.test.js
  - .claude/advisor-mode/tests/runtime-semantics.test.js
  - .claude/hooks/advisor-failure-tracker.js
  - .claude/hooks/advisor-gate.js
  - .claude/hooks/advisor-runtime-probe.js
  - .claude/settings.json
findings:
  critical: 4
  warning: 0
  info: 0
  total: 4
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-22T04:30:11Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 2 advisor gate implementation across hook wiring, gate evaluation, failure tracking, runtime probe semantics, schemas, and tests. The main problems are behavioral, not stylistic: the repeated-failure gate is not actually connected end-to-end, human approval can be bypassed or never satisfied in live execution, and the failure tracker misclassifies successful commands as failures.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Human rejection, defer, and revise still authorize the blocked action

**File:** `.claude/hooks/advisor-gate.js:394-414`, `.claude/hooks/advisor-runtime-probe.js:109-132`, `.claude/hooks/advisor-runtime-probe.js:167-173`
**Issue:** Both re-entry evaluators treat any syntactically valid disposition (`approve`, `reject`, `revise`, or `defer`) as `workflowGateStatus: 'satisfied'` with `reentryAllowed: true`, and the runtime probe converts that state into `permissionDecision: 'allow'`. In production this means a human can explicitly reject or defer a risky operation and the executor can still rerun the blocked mutation successfully on retry. That is an authorization failure on the core safety boundary.
**Fix:** Only `approve` should allow the original blocked action to proceed. `reject`, `revise`, and `defer` should keep the gate denied and surface distinct reason codes.

```js
if (readResult.disposition.disposition !== "approve") {
  return {
    ...base,
    reasonCode: `disposition-${readResult.disposition.disposition}`,
  };
}

return {
  ...base,
  workflowGateStatus: "satisfied",
  reentryAllowed: true,
  disposition: "approve",
  reasonCode: "valid-disposition",
};
```

### CR-02: Human approval is never actually enforced or cleared by the live hook chain

**File:** `.claude/settings.json:81-142`, `.claude/hooks/advisor-gate.js:456-472`, `.claude/hooks/advisor-gate.js:394-414`
**Issue:** The only configured `PreToolUse` enforcement hook is `advisor-gate.js`. When a rule uses `gateAction: "human-approval"`, `evaluateGatePolicy()` only calls `buildDecisionPacket()` and always returns a blocked packet; it never checks `evaluateHumanGateReentry()`. Separately, `advisor-runtime-probe.js` is the only code that turns a disposition artifact into an allow/deny decision, but it is not wired into `.claude/settings.json` at all. Result: human approval is not a functioning runtime gate. In live execution the action either stays permanently blocked even after a valid disposition exists, or teams bypass the mechanism entirely.
**Fix:** Wire a dedicated `PreToolUse` hook for disposition re-entry, or fold the disposition check into `evaluateGatePolicy()` before rebuilding the human packet.

```js
if (rule.gateAction === 'human-approval') {
  const packet = buildDecisionPacket(...);
  if (packet.event === 'human_approval.required') {
    const reentry = evaluateHumanGateReentry(packet, options);
    if (reentry.workflowGateStatus === 'satisfied') {
      return {
        ...reentry,
        gateAction: 'allow',
        policyRuleId: rule.id,
        hookOutput: buildDecision('allow', 'Approved human disposition found; explicit retry may proceed.'),
      };
    }
  }
  return {
    ...packet,
    gateAction: 'block',
    policyRuleId: rule.id,
    hookOutput: buildDecision('deny', 'Human approval is required before this workflow path proceeds.'),
  };
}
```

Also add the runtime probe to `PreToolUse` in `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/settings.json` if you keep it as a separate hook.

### CR-03: Repeated-failure escalation is disconnected from the gate that is supposed to enforce it

**File:** `.claude/hooks/advisor-failure-tracker.js:152-187`, `.claude/hooks/advisor-gate.js:31-36`, `.claude/hooks/advisor-gate.js:135-145`, `.claude/advisor-mode/policy.example.json:72-76`
**Issue:** `advisor-failure-tracker.js` runs in `PostToolUse`, increments local state, and emits only `additionalContext` JSON when the threshold is hit. `advisor-gate.js` never reads that state file or that emitted context; it only consults `raw.failureCount` from the incoming `PreToolUse` payload. Nothing in this phase wires `failureCount` from the tracker into later `PreToolUse` events. So the advertised repeated-failure gate in policy is not actually enforceable end-to-end outside the unit tests that inject `failureCount: 2` manually.
**Fix:** Make the `PreToolUse` gate derive failure count from persisted state, or have a real hook pipeline field that `advisor-gate.js` consumes. For example, key failure history by normalized signature and reload it during `evaluateGatePolicy()` for verification commands.

```js
function getPersistedFailureCount(event, options = {}) {
  const statePath = path.join(
    getRoot(options),
    ".advisor",
    "state",
    "failure-signatures.json",
  );
  const state = readJson(statePath, { signatures: {} });
  const signature = normalizeFailureSignature({
    toolName: event.toolName,
    toolInput: event.toolInput,
  });
  return Number(state.signatures?.[signature]?.count || 0);
}
```

Then use that value instead of trusting a host-supplied `failureCount` that is never populated by this implementation.

### CR-04: Successful commands with normal output are counted as failures

**File:** `.claude/hooks/advisor-failure-tracker.js:146-150`
**Issue:** `isFailure()` returns `true` whenever `getOutputText(payload)` is non-empty. Any successful `Bash` command that prints to stdout (`git status`, test runners, linters, build tools) is therefore recorded as a failure, increments the repeated-failure counter, and can trigger advisor escalation on the second successful command. This creates false positive gating and corrupts the audit/state artifacts that later decisions depend on.
**Fix:** Treat output as diagnostic context only. Failure should depend on non-zero exit status or explicit failure status fields.

```js
function isFailure(payload = {}) {
  const exitCode = Number(getExitCode(payload));
  const status = String(
    pick(payload.status, getToolResponse(payload).status, ""),
  ).toLowerCase();
  return exitCode !== 0 || ["failed", "failure", "error"].includes(status);
}
```

---

_Reviewed: 2026-05-22T04:30:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
