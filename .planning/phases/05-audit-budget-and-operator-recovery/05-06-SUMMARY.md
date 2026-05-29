---
phase: 05-audit-budget-and-operator-recovery
plan: 06
subsystem: advisor-mode-budget
status: complete
tags: [budget, hard-caps, degraded-mode, hooks, node-test]
dependency_graph:
  requires:
    - phase: 05-audit-budget-and-operator-recovery
      plan: 05
      provides: append-only audit stream and correlated hook audit events
  provides:
    - SAFE-01 task/session advisor budget hard caps
    - advisor call/token/latency usage accounting
    - degraded non-critical budget over-limit behavior
    - mandatory final-review and critical human-approval preservation during budget degradation
  affects:
    [advisor-gate, advisor-final-review-gate, final-review, policy-example]
tech-stack:
  added: []
  patterns:
    - Node.js CommonJS budget helper using runtimePath state storage
    - node:test budget regression coverage
    - append-only budget audit events
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
  - "Use runtimePath(root, ['state', 'advisor-budget.json']) for local budget state rather than planning artifacts."
  - "Apply budget degraded mode only to non-critical advisor paths; final review and critical human approval remain mandatory."
  - "Use idempotent usage event keys to prevent retry/artifact reread double-counting."
requirements-completed: [SAFE-01]
metrics:
  duration: reused-existing-main-implementation
  completed: 2026-05-29T09:30:47Z
  tasks: 2
  commits: 3
---

# Phase 05 Plan 06: Budget Caps and Degraded Mode Summary

**Advisor call, token, and latency hard caps are enforced across task/session scopes with audited degraded mode for non-critical paths and mandatory final-review/human-approval preservation.**

## Performance

- **Duration:** reused existing budget implementation from main; verification rerun in this worktree
- **Started:** 2026-05-29T09:20:00Z
- **Completed:** 2026-05-29T09:30:47Z
- **Tasks:** 2
- **Files modified:** 6 budget-related files already present after merging main

## Accomplishments

- Verified `.claude/advisor-mode/budget-state.js` provides policy loading, task/session scope keys, persisted state, usage accounting, hard-cap evaluation, and budget audit event construction.
- Verified `.claude/advisor-mode/policy.example.json` includes task and session caps for `advisorCalls`, `advisorTokens`, and `advisorLatencyMs`.
- Verified `.claude/hooks/advisor-gate.js` evaluates budget before new non-critical advisor consultations and degrades over-limit paths to advisory output with `budget.exceeded` audit events.
- Verified `.claude/hooks/advisor-final-review-gate.js` evaluates budget while preserving mandatory final-review blocking semantics.
- Verified `.claude/advisor-mode/final-review.js` records final-review verdict usage with token/latency metadata when present and idempotent event accounting.

## Task Commits

1. **Task 1: RED hard-cap, metadata, and degraded-mode tests** - `2dd610a` (test)
2. **Task 2: GREEN budget hard caps, state, policy, and hook instrumentation** - `1170fe9` (feat)
3. **Task 2 Refactor: Harden budget accounting edge cases** - `ff2024b` (refactor)

## Files Created/Modified

- `.claude/advisor-mode/budget-state.js` - Budget policy loader, runtime state persistence, hard-cap evaluator, usage recorder, and budget audit event builder.
- `.claude/advisor-mode/tests/budget-state.test.js` - SAFE-01 coverage for triple caps, both scopes, degraded mode, final-review preservation, usage metadata, and idempotency.
- `.claude/advisor-mode/policy.example.json` - Example task/session advisor call, token, and latency caps.
- `.claude/hooks/advisor-gate.js` - PreToolUse budget evaluation and advisor artifact usage instrumentation.
- `.claude/hooks/advisor-final-review-gate.js` - Stop-hook budget evaluation while preserving mandatory final review.
- `.claude/advisor-mode/final-review.js` - Final-review verdict usage accounting.

## Decisions Made

- Budget state lives under the Advisor Mode runtime state path, not `.planning/`, to keep runtime counters local and ignored.
- Over-limit non-critical advisor paths degrade to warning/advisory mode; final review and critical human approval do not degrade because they are mandatory controls.
- Usage accounting is idempotent per event/artifact key so satisfied retries and artifact rereads do not inflate call/token/latency counters.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved satisfied advisor reentry before budget degradation**

- **Found during:** Task 2 refactor review
- **Issue:** Budget exceedance could be checked before an existing valid advisor recommendation, causing a satisfied retry to downgrade to advisory.
- **Fix:** Valid recommendation reentry is evaluated before non-critical budget degradation.
- **Files modified:** `.claude/hooks/advisor-gate.js`
- **Commit:** `ff2024b`

**2. [Rule 2 - Missing critical functionality] Failed closed on invalid strict budget state**

- **Found during:** Task 2 refactor review and threat model T-05-05
- **Issue:** Malformed budget state needed deterministic strict-mode fail-closed behavior.
- **Fix:** Strict PreToolUse blocks invalid budget state; final-review converts invalid budget state into a block when it would otherwise allow completion.
- **Files modified:** `.claude/advisor-mode/budget-state.js`, `.claude/hooks/advisor-gate.js`, `.claude/hooks/advisor-final-review-gate.js`
- **Commit:** `ff2024b`

**3. [Rule 2 - Missing critical functionality] Wired final-review state recording to budget usage**

- **Found during:** Task 2 refactor review
- **Issue:** Final-review usage accounting was available as a helper but needed to run from normal final-review state recording.
- **Fix:** `recordFinalReviewState()` records final-review verdict usage with available metadata.
- **Files modified:** `.claude/advisor-mode/final-review.js`, `.claude/advisor-mode/tests/budget-state.test.js`
- **Commit:** `ff2024b`

## Issues Encountered

- The worktree initially lacked Phase 05 plan files and prior Phase 05 implementation commits. Merged `main` fast-forward to bring the orchestrator-owned plan context and existing atomic task commits into the worktree, then verified Plan 06 artifacts without changing STATE.md or ROADMAP.md.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The budget state trust boundary is covered by T-05-04 through T-05-06 and verified by tests for scope binding, malformed state fail-closed behavior, and idempotent accounting.

## User Setup Required

None - no external service configuration or package install required.

## Verification

| Command                                                          | Result                       |
| ---------------------------------------------------------------- | ---------------------------- |
| `node --test .claude/advisor-mode/tests/budget-state.test.js`    | PASS: 10/10 tests            |
| `node --test .claude/advisor-mode/tests/*.test.js`               | PASS: 134/134 tests          |
| `git log --oneline --all \| grep -E '2dd610a\|1170fe9\|ff2024b'` | PASS: all task commits found |

## TDD Gate Compliance

- RED commit present: `2dd610a`
- GREEN commit present after RED: `1170fe9`
- REFACTOR commit present after GREEN: `ff2024b`

## Self-Check: PASSED

- Created/modified files exist:
  - `.claude/advisor-mode/budget-state.js`
  - `.claude/advisor-mode/tests/budget-state.test.js`
  - `.claude/advisor-mode/policy.example.json`
  - `.claude/hooks/advisor-gate.js`
  - `.claude/hooks/advisor-final-review-gate.js`
  - `.claude/advisor-mode/final-review.js`
- Commits found:
  - `2dd610a`
  - `1170fe9`
  - `ff2024b`
- Verification passed with targeted and full Advisor Mode suites.

## Next Phase Readiness

Plan 06 is complete and SAFE-01 budget enforcement is ready for the remaining Phase 05 operator recovery and final packaging work.

---

_Phase: 05-audit-budget-and-operator-recovery_
_Completed: 2026-05-29T09:30:47Z_
