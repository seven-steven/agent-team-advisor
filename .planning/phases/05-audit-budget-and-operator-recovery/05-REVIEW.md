---
phase: 05-audit-budget-and-operator-recovery
reviewed: 2026-05-29T09:49:31Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - .claude/advisor-mode/README.md
  - .claude/advisor-mode/final-review.js
  - .claude/advisor-mode/policy.example.json
  - .claude/advisor-mode/provider-routes.example.json
  - .claude/advisor-mode/provider-routing.js
  - .claude/advisor-mode/runtime-paths.js
  - .claude/advisor-mode/tests/failure-and-human-gates.test.js
  - .claude/advisor-mode/tests/final-review-gate.test.js
  - .claude/advisor-mode/tests/provider-routing.test.js
  - .claude/advisor-mode/tests/verdict-handoff.test.js
  - .claude/advisor-mode/tests/verification-evidence.test.js
  - .claude/hooks/advisor-failure-tracker.js
  - .claude/hooks/advisor-final-review-gate.js
  - .claude/hooks/advisor-gate.js
  - .claude/hooks/executor-route-audit.js
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-29T09:49:31Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the available Phase 05 advisor-mode runtime, gate, routing, and final-review artifacts plus their covering tests. The implementation still has two ship-blocking correctness/security problems in the gating flow: repeated verification failures are not reliably escalated from persisted PostToolUse state, and human dispositions can be replayed against later advisor recommendations because the approval artifact is not bound to the reviewed request/recommendation version. There is also a robustness defect in final-review freshness checking that can spuriously block completion when the changed-file list order changes.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Repeated-failure gate cannot reliably match persisted failure state during PreToolUse

**Classification:** BLOCKER

**File:** `.claude/hooks/advisor-gate.js:86-98`, `.claude/hooks/advisor-failure-tracker.js:66-75`

**Issue:** `advisor-failure-tracker` persists counts under a signature that includes `exitCode`, normalized stderr/stdout text, and an inferred error class. `advisor-gate` tries to recover that count during `PreToolUse`, but it recomputes the signature from the new pre-tool event. A normal `PreToolUse` payload does not carry `toolResponse`, `exitCode`, or prior error output, so the recomputed signature becomes `exit:unknown|error:unknown-error|text:` and no longer matches the `PostToolUse` signature that was stored after the earlier failures. The tests only pass because they inject `toolResponse` into the `PreToolUse` event manually. In real hook execution this means the Phase 2/5 policy path described in the README (`PostToolUse` tracks failures, `PreToolUse` blocks at threshold 2) will silently fail to trigger for repeated verification failures.

**Fix:** Persist and look up repeated failures by a stable pre-execution key instead of by the full post-failure signature. For example, store a second key derived only from `toolName`, normalized command/path input, and task state, then let `advisor-gate` query by that stable key:

```js
// advisor-failure-tracker.js
function stableFailureKey(payload = {}) {
  return stableStringify({
    toolName: pick(payload.toolName, payload.tool_name, "unknown-tool"),
    toolInput: payload.toolInput || payload.tool_input || {},
    taskState: pick(payload.taskState, payload.task_state, "unknown"),
  });
}

// persist counts under stableFailureKey(...)
```

```js
// advisor-gate.js
const key = stableFailureKey({
  toolName: event.toolName,
  toolInput: event.toolInput,
  taskState: event.taskState,
});
const count = Number(state.keys?.[key]?.count || 0);
```

### CR-02: Human approval artifacts are replayable against later advisor recommendations

**Classification:** BLOCKER

**File:** `.claude/hooks/advisor-gate.js:523-555`

**Issue:** `validateDisposition()` only checks `correlationKey`, `event`, `disposition`, and a few string fields. `evaluateHumanGateReentry()` then accepts any matching disposition forever, without verifying that it was produced for the same advisor recommendation or even the same request payload contents. If the recommendation artifact is regenerated with materially different advice, or the request packet changes while keeping the same correlation key, an old `approve` disposition still unlocks the critical path. That breaks the intended “advisor recommendation first, then explicit human disposition for that recommendation” control and creates a policy bypass on destructive / credential / production-affecting actions.

**Fix:** Bind the disposition to immutable request/recommendation identity and validate that binding on re-entry. At minimum include `requestPath`, `recommendationPath`, and a request/recommendation hash in the stored artifact and compare them during `evaluateHumanGateReentry()`:

```js
// when writing disposition
appliesTo: {
  event: packet.event,
  requestPath: packet.requestPath,
  recommendationPath: packet.advisorRecommendationPath,
  recommendationHash,
}
```

```js
// during validation
if (disposition.appliesTo.requestPath !== packet.requestPath) return false;
if (disposition.appliesTo.recommendationPath !== packet.recommendationPath)
  return false;
if (
  disposition.appliesTo.recommendationHash !==
  hash(packet.advisorRecommendation)
)
  return false;
```

## Warnings

### WR-01: Final-review freshness check treats changed file order as semantic state

**Classification:** WARNING

**File:** `.claude/advisor-mode/final-review.js:551-553`, `.claude/advisor-mode/final-review.js:597-603`

**Issue:** `isFinalReviewFresh()` calls `sameStringArray()` and requires `changed_files` to match in exactly the same order. The final-review state is supposed to protect against content drift, but order is not a semantic property of the reviewed file set. If the executor records `['a', 'b']` and the Stop hook later sends `['b', 'a']`, the gate reports `changed_files mismatch` and blocks completion even though the reviewed scope is identical. This will produce false stale-review failures whenever callers serialize the same set in a different order.

**Fix:** Normalize the arrays before comparing, or compare them as sets while preserving duplicate detection if needed:

```js
function sameFileSet(left, right) {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length !== right.length
  )
    return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}
```

Use `sameFileSet()` inside `isFinalReviewFresh()` and normalize before writing state if deterministic ordering is desired.

---

_Reviewed: 2026-05-29T09:49:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
