---
phase: 05-audit-budget-and-operator-recovery
plan: 02
subsystem: budget-control
tags: [node, commonjs, budget, audit, hooks, tdd]
requires:
  - phase: 05-audit-budget-and-operator-recovery
    plan: 01
    provides: append-only audit writer and correlated hook audit events
provides:
  - task/session advisor budget policy loader and persisted budget state
  - advisor call, token, and latency hard-cap evaluation
  - degraded non-critical advisor gate behavior with budget audit events
  - final-review budget evaluation while preserving mandatory review semantics
affects:
  [advisor-gate, final-review-gate, final-review, policy-example, audit-log]
tech-stack:
  added: []
  patterns:
    - CommonJS budget helper using Node built-ins only
    - runtimePath(root, ['state', 'advisor-budget.json']) budget state persistence
    - idempotent event-key accounting for ordinary and final-review advisor artifacts
key-files:
  created:
    - .claude/advisor-mode/budget-state.js
    - .claude/advisor-mode/tests/budget-state.test.js
  modified:
    - .claude/advisor-mode/policy.example.json
    - .claude/hooks/advisor-gate.js
    - .claude/hooks/advisor-final-review-gate.js
    - .claude/advisor-mode/final-review.js
key-decisions:
  - "Use task and session scope keys in one advisor-budget.json state file under runtimePath state storage."
  - "Degrade only non-critical advisor consultation paths on budget exceedance; preserve human-approval and final-review mandatory gates."
  - "Use idempotent event keys so satisfied retries and repeated artifact reads do not double-count calls, tokens, or latency."
requirements-completed: [SAFE-01]
duration: 39min
completed: 2026-05-29T06:06:42Z
---

# Phase 05 Plan 02: Budget-Control Vertical Slice Summary

**Advisor call, token, and latency hard caps now apply across task/session scopes for ordinary and final-review advisor paths.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-05-29T05:28:00Z
- **Completed:** 2026-05-29T06:06:42Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `.claude/advisor-mode/budget-state.js` with budget policy loading, state read/write, task/session scope keys, usage recording, budget evaluation, and `budget.exceeded` audit event construction.
- Added `advisorMode.budget` defaults to `.claude/advisor-mode/policy.example.json` for `advisorCalls`, `advisorTokens`, and `advisorLatencyMs` at both task and session scopes.
- Wired `.claude/hooks/advisor-gate.js` so normal advisor recommendation/verdict metadata is accounted before later budget decisions; over-limit non-critical paths return advisory degraded mode with audit events.
- Wired `.claude/hooks/advisor-final-review-gate.js` so fresh final-review requirements evaluate budget while preserving strict final-review blocking semantics.
- Added final-review verdict usage accounting through `.claude/advisor-mode/final-review.js` and ensured missing metadata does not fabricate token or latency usage.
- Added Node `node:test` coverage for triple caps, both scopes, ordinary usage accumulation, degraded gate behavior, final-review budget preservation, satisfied retry behavior, and artifact idempotency.

## Task Commits

1. **Task 1: RED budget cap tests** - `2dd610a` (test)
2. **Task 2: GREEN budget state and advisor-gate integration** - `1170fe9` (feat)
3. **Task 3: REFACTOR budget accounting edge cases** - `ff2024b` (refactor)

## Files Created/Modified

- `.claude/advisor-mode/budget-state.js` - Shared budget state, cap evaluation, scope keys, audit event helper.
- `.claude/advisor-mode/tests/budget-state.test.js` - TDD coverage for budget caps, degraded behavior, final-review accounting, and idempotency.
- `.claude/advisor-mode/policy.example.json` - Example task/session advisor call, token, and latency caps.
- `.claude/hooks/advisor-gate.js` - Budget evaluation and ordinary advisor artifact accounting for PreToolUse gates.
- `.claude/hooks/advisor-final-review-gate.js` - Budget evaluation for fresh final-review requirements while preserving mandatory gate behavior.
- `.claude/advisor-mode/final-review.js` - Final-review verdict usage accounting hook.

## Decisions Made

- Stored budget state under runtime `state/advisor-budget.json`, not `.planning/`, matching Phase 5 runtime artifact conventions.
- Counted new advisor consultations/recommendation/verdict/final-review events once per event key; repeated satisfied retries and repeated artifact reads are idempotent.
- Kept over-limit non-critical advisor paths in warning-only degraded mode, while human-approval and final-review gates remain strict where configured.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved satisfied advisor reentry before budget degradation**

- **Found during:** Task 3 code review
- **Issue:** Budget exceedance was checked before reading an existing valid advisor recommendation, so a previously satisfied retry could downgrade to advisory mode.
- **Fix:** Moved non-critical budget degradation after valid recommendation reentry detection.
- **Files modified:** `.claude/hooks/advisor-gate.js`
- **Commit:** `ff2024b`

**2. [Rule 2 - Missing critical functionality] Failed closed on invalid strict budget state**

- **Found during:** Task 3 code review / threat model T-05-05
- **Issue:** Malformed budget state could crash PreToolUse or allow strict final-review completion with only metadata attached.
- **Fix:** PreToolUse catches invalid budget state and blocks in strict mode; final-review converts invalid budget state into a block only when it would otherwise allow completion.
- **Files modified:** `.claude/hooks/advisor-gate.js`, `.claude/hooks/advisor-final-review-gate.js`, `.claude/advisor-mode/budget-state.js`
- **Commit:** `ff2024b`

**3. [Rule 2 - Missing critical functionality] Wired production final-review state recording to budget usage**

- **Found during:** Task 3 code review
- **Issue:** The final-review budget usage helper was tested directly but not reached from the normal final-review state recording path.
- **Fix:** `recordFinalReviewState()` now records final-review verdict usage when final-review state is recorded, using provided metadata when present.
- **Files modified:** `.claude/advisor-mode/final-review.js`
- **Commit:** `ff2024b`

---

**Total deviations:** 3 auto-fixed (1 bug fix, 2 missing critical functionality fixes)
**Impact on plan:** All fixes directly supported the planned budget correctness and threat mitigations.

## Issues Encountered

- `/code-review` identified four in-scope correctness concerns; all were resolved or covered by the refactor commit.
- `/simplify` suggested minor API and helper reductions; only the no-op duplicate write reduction was applied to keep public plan exports stable.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. New budget state persistence and hook/final-review budget decisions are covered by T-05-04 through T-05-06.

## User Setup Required

None - no external service configuration or package install required.

## Verification

- `node --test .claude/advisor-mode/tests/budget-state.test.js` (RED failed before implementation because `budget-state.js` was missing)
- `node --test .claude/advisor-mode/tests/budget-state.test.js .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/final-review-gate.test.js` (PASS, 33/33 tests)
- `node --check .claude/hooks/advisor-gate.js && node --check .claude/hooks/advisor-final-review-gate.js && node --check .claude/advisor-mode/final-review.js`
- `/code-review` and `/simplify` invoked for the Task 3 refactor scope.

## TDD Gate Compliance

- RED commit present: `2dd610a`
- GREEN commit present after RED: `1170fe9`
- REFACTOR commit present after GREEN: `ff2024b`

## Next Phase Readiness

- Plan 05-03 can build doctor validation against budget policy and runtime state now that budget configuration and state paths are stable.
- No blockers remain for Phase 05 Plan 03.

## Self-Check: PASSED

- Created files exist: `.claude/advisor-mode/budget-state.js`, `.claude/advisor-mode/tests/budget-state.test.js`.
- Task commits exist: `2dd610a`, `1170fe9`, `ff2024b`.
- Final verification command passed with 33/33 tests.

---

_Phase: 05-audit-budget-and-operator-recovery_
_Completed: 2026-05-29T06:06:42Z_
