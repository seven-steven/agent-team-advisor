---
phase: 05-audit-budget-and-operator-recovery
plan: 05
subsystem: advisor-mode-audit
status: complete
tags: [audit, correlation, operator-inspection, hooks]
dependency_graph:
  requires: [AUDT-01, AUDT-03]
  provides: [append-only-audit-stream, dual-key-correlation, audit-cli-views]
  affects:
    [advisor-gate, final-review-gate, provider-routing, executor-route-audit]
tech_stack:
  added: [Node.js CommonJS audit-log.js]
  patterns:
    [append-only JSONL, sanitized audit output, task/session correlation]
key_files:
  created:
    - .claude/advisor-mode/audit-log.js
    - .claude/advisor-mode/tests/audit-log.test.js
  modified:
    - .claude/hooks/executor-route-audit.js
    - .claude/advisor-mode/provider-routing.js
    - .claude/advisor-mode/final-review.js
    - .claude/hooks/advisor-gate.js
    - .claude/hooks/advisor-final-review-gate.js
decisions:
  - "Use runtimePath(root, ['audit', 'events.jsonl']) as the official append-only audit stream."
  - "Preserve taskId and sessionId only when explicitly supplied; degraded fallback metadata never fabricates either field."
metrics:
  completed: 2026-05-29T00:00:00Z
  tasks: 2
  commits: 2
---

# Phase 05 Plan 05: Correlated Audit History Summary

Implemented a shared append-only Advisor Mode audit stream with sanitized raw events, task/session/correlation views, strict dual-key correlation, and producer coverage for advisor triggers, hook decisions, provider routes, advisor verdict/final-review decisions, executor decisions, and final-review gate decisions.

## Completed Tasks

| Task | Name                                                                 | Commit  | Files                                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | RED audit stream, dual-key correlation, and producer coverage tests  | c3a0387 | .claude/advisor-mode/tests/audit-log.test.js                                                                                                                                                                                                                                      |
| 2    | GREEN audit module, inspection surface, and complete producer wiring | 8cb9097 | .claude/advisor-mode/audit-log.js; .claude/hooks/executor-route-audit.js; .claude/advisor-mode/provider-routing.js; .claude/advisor-mode/final-review.js; .claude/hooks/advisor-gate.js; .claude/hooks/advisor-final-review-gate.js; .claude/advisor-mode/tests/audit-log.test.js |

## What Changed

- Added `.claude/advisor-mode/audit-log.js` with `appendAuditEvent`, `readAuditEvents`, `filterAuditEvents`, `buildCorrelationFields`, `sanitizeAuditEvent`, and `main`.
- Added Node `node:test` coverage for append-only ordering, strict task/session correlation, fallback metadata, raw/task/session/correlation CLI views, sanitization, and producer wiring.
- Replaced scattered audit writes in provider route, executor route, final-review, advisor gate, and final-review gate paths with the shared sanitized audit writer.
- Preserved configured-vs-observed provider route semantics and only records observed model when runtime response metadata provides it.

## Verification

| Command                                                    | Result              |
| ---------------------------------------------------------- | ------------------- |
| `node --test .claude/advisor-mode/tests/audit-log.test.js` | PASS: 5/5 tests     |
| `node --test .claude/advisor-mode/tests/*.test.js`         | PASS: 108/108 tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added degraded fallback source metadata**

- **Found during:** Task 2
- **Issue:** The plan required fallback/degraded metadata to be recorded separately and not fabricated into `taskId` or `sessionId`.
- **Fix:** `buildCorrelationFields` now emits `correlationFallback.source` and `correlationFallback.reason` when using session/task fallback or deterministic hash.
- **Files modified:** `.claude/advisor-mode/audit-log.js`, `.claude/advisor-mode/tests/audit-log.test.js`
- **Commit:** 8cb9097

**2. [Rule 1 - Bug] Preserved existing executor decision audit event name**

- **Found during:** Task 2 full-suite verification
- **Issue:** New tests initially used `executor_decision.recorded`, but existing regression tests require `executor.final_review_decision.recorded`.
- **Fix:** Kept the established event name and updated new coverage accordingly while still satisfying executor follow-up decision audit coverage.
- **Files modified:** `.claude/advisor-mode/final-review.js`, `.claude/advisor-mode/tests/audit-log.test.js`
- **Commit:** 8cb9097

## Known Stubs

None.

## Threat Flags

| Flag                              | File                              | Description                                                                                                                                   |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: persistent-audit-log | .claude/advisor-mode/audit-log.js | New persistent JSONL audit writer and CLI reader at the local runtime trust boundary; mitigated by append-only writes and sanitization tests. |

## Self-Check: PASSED

- Found created/modified files:
  - `.claude/advisor-mode/audit-log.js`
  - `.claude/advisor-mode/tests/audit-log.test.js`
  - `.claude/hooks/executor-route-audit.js`
  - `.claude/advisor-mode/provider-routing.js`
  - `.claude/advisor-mode/final-review.js`
  - `.claude/hooks/advisor-gate.js`
  - `.claude/hooks/advisor-final-review-gate.js`
- Found commits:
  - `c3a0387`
  - `8cb9097`
