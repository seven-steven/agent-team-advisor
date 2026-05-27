---
phase: 03-verdict-handoff-and-verification-evidence
plan: 05
subsystem: advisor-handoff
tags: [advisor-mode, final-review-gate, stop-hook, node-test]
requires:
  - phase: 03-verdict-handoff-and-verification-evidence
    provides: structured verdicts, executor decisions, and verification evidence artifacts from plans 03-02 through 03-04
provides:
  - completion-time Stop hook final review gate
  - final-review freshness state recorder and validator
  - freshness binding to verdict, verification evidence, executor decision, changed files, fingerprint, and review timestamp
  - Node test coverage for missing, stale, PASS, non-PASS, and settings wiring behavior
affects: [phase-03-completion-gate, final-review-handoff, guarded-completion]
tech-stack:
  added: []
  patterns:
    - CommonJS pure utility exports
    - Claude Code Stop hook gating
    - .advisor/state runtime freshness file
    - Node built-in tests with temp repo fixtures
key-files:
  created:
    - .claude/hooks/advisor-final-review-gate.js
    - .claude/advisor-mode/tests/final-review-gate.test.js
  modified:
    - .claude/advisor-mode/final-review.js
    - .claude/settings.json
key-decisions:
  - "Final-review freshness is stored in .advisor/state/final-review.json and bound to current verdict, verification evidence, changed files, fingerprint, and reviewed_at."
  - "Only PASS verdicts allow direct completion; CONCERNS, FAIL, and BLOCKED require a matching executor-decision artifact."
patterns-established:
  - "Completion gates use explicit taskState non-trivial-completion or requiresFinalReview inputs, not transcript heuristics."
  - "Stop hook wiring preserves existing advisor hooks and adds exactly one advisor-final-review-gate command."
requirements-completed: [GATE-03, VERD-02, AUDT-02]
duration: 27min
completed: 2026-05-27
---

# Phase 03 Plan 05: Completion-Time Final Review Gate Slice Summary

**Stop-hook completion gate requiring fresh advisor final review tied to current evidence and changed-file fingerprint**

## Performance

- **Duration:** 27 min
- **Started:** 2026-05-27T07:04:31Z
- **Completed:** 2026-05-27T07:31:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added RED coverage for missing final review, stale evidence/fingerprint, PASS allow, non-PASS executor-decision requirements, and prior consultation non-reuse.
- Implemented `recordFinalReviewState` and `isFinalReviewFresh` using `.advisor/state/final-review.json` with freshness bound to correlation key, verdict ref, evidence ref, executor decision ref when required, changed files, fingerprint, and review timestamp.
- Added `.claude/hooks/advisor-final-review-gate.js` exporting `evaluateFinalReviewGate`, blocking explicit non-trivial completion without a fresh final review and allowing only PASS or non-PASS with matching executor decision.
- Wired `.claude/settings.json` with exactly one Stop hook for `advisor-final-review-gate.js` while preserving `advisor-gate.js`, `advisor-boundary-check.js`, and `advisor-failure-tracker.js`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED final-review freshness gate contract** - `242e9a5` (test)
2. **Task 2: GREEN final-review hook and freshness state** - `683770c` (feat)
3. **Task 3: Wire Stop hook idempotently** - `48309d9` (chore)

**Plan metadata:** pending at summary creation

_Note: TDD tasks used separate RED and GREEN commits; no cleanup-only refactor commit was needed._

## Files Created/Modified

- `.claude/advisor-mode/tests/final-review-gate.test.js` - Node test coverage for final-review gate freshness, stale artifact rejection, PASS allow, non-PASS executor decision requirements, and Stop hook wiring uniqueness.
- `.claude/hooks/advisor-final-review-gate.js` - Stop hook gate implementation and `evaluateFinalReviewGate` export.
- `.claude/advisor-mode/final-review.js` - Final review state recording and freshness validation exports.
- `.claude/settings.json` - Project-local Stop hook wiring for completion-time final review.

## Decisions Made

- Used explicit completion state (`taskState: non-trivial-completion` or `requiresFinalReview: true`) as the only trigger, matching D-02 and avoiding transcript keyword heuristics.
- Treated prior consultation recommendation artifacts as insufficient for completion; only `.advisor/state/final-review.json` plus matching verdict/evidence artifacts can satisfy the gate.
- Required executor-decision validation for all non-PASS final verdict statuses before completion can allow.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The spawned worktree initially lacked Phase 03 planning artifacts and upstream Phase 03 implementation files; fast-forwarded the worktree branch to `main` before editing. No out-of-scope files were modified by this plan after the fast-forward.
- Repeated advisor consultation hook messages appeared during tool use as expected orchestration noise per the execution prompt; they did not block implementation or verification.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. This plan implements the planned Stop hook and local `.advisor/state/final-review.json` trust boundary mitigations from T-03-12 through T-03-14.

## Verification

- `node --test .claude/advisor-mode/tests/final-review-gate.test.js` — PASS, 5 tests passed.
- `node --test .claude/advisor-mode/tests/*.test.js` — PASS, 65 tests passed.
- `node --check .claude/hooks/advisor-final-review-gate.js` — PASS.
- `node --check .claude/advisor-mode/final-review.js` — PASS.

## TDD Gate Compliance

- RED commit exists: `242e9a5`.
- GREEN commit exists after RED: `683770c`.
- Refactor commit was not needed; no cleanup-only change was identified after GREEN.

## Self-Check: PASSED

- Created files exist: `.claude/hooks/advisor-final-review-gate.js`, `.claude/advisor-mode/tests/final-review-gate.test.js`.
- Modified files exist: `.claude/advisor-mode/final-review.js`, `.claude/settings.json`.
- Task commits exist: `242e9a5`, `683770c`, `48309d9`.
- Final verification commands exit 0.

## Next Phase Readiness

Ready for Phase 03 Plan 06. Completion-time final review can now consume structured verdicts, verification evidence, and executor-decision artifacts.

---

_Phase: 03-verdict-handoff-and-verification-evidence_
_Completed: 2026-05-27_
