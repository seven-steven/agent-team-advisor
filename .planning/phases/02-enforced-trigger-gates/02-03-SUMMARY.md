---
phase: 02-enforced-trigger-gates
plan: 03
subsystem: hooks
tags: [claude-code, posttooluse, advisor-mode, human-approval, tdd]

requires:
  - phase: 02-enforced-trigger-gates
    provides: Policy-driven advisor consultation gate and read-only advisor recommendation validation from plan 02-02
provides:
  - Threshold-2 repeated failure tracker with ignored runtime state and audit events
  - Human approval packet builder requiring a matching read-only advisor recommendation
  - Approve/reject/revise/defer disposition persistence and explicit retry re-entry validation
  - PostToolUse wiring for failure escalation across executor mutation and command tools
affects: [advisor-gates, runtime-artifacts, human-approval, phase-02]

tech-stack:
  added: []
  patterns:
    - CommonJS Node built-in PostToolUse failure tracker
    - Strict JSON Schema draft 2020-12 workflow artifacts
    - Explicit human disposition artifacts for re-entry instead of host wait-and-resume

key-files:
  created:
    - .claude/advisor-mode/tests/failure-and-human-gates.test.js
    - .claude/hooks/advisor-failure-tracker.js
    - .claude/advisor-mode/decision-packet.schema.json
    - .claude/advisor-mode/disposition.schema.json
    - .claude/advisor-mode/gate-event.schema.json
    - .advisor/decisions/dispositions/.gitkeep
  modified:
    - .claude/hooks/advisor-gate.js
    - .claude/settings.json
    - .gitignore

key-decisions:
  - "Repeated failure escalation is advisory workflow state and exits fail-open for PostToolUse host execution."
  - "Human approval requires a validated read-only advisor recommendation before any human packet is emitted."
  - "Approve/reject/revise/defer decisions are persisted as ignored runtime disposition artifacts and require explicit retry for re-entry."

patterns-established:
  - "Failure signatures strip volatile paths, timestamps, IDs, and hashes while preserving tool, exit status, action, and error class."
  - "Human gate re-entry is satisfied only by matching correlationKey and appliesTo.event on a disposition artifact."

requirements-completed: [GATE-02, GATE-04, GATE-06]

duration: 52min
completed: 2026-05-22
---

# Phase 02 Plan 03: Repeated Failure and Human Disposition Gates Summary

**Threshold-2 failure escalation plus read-only-advisor-backed human approval packets with persisted approve/reject/revise/defer re-entry dispositions.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-05-22T04:10:00Z
- **Completed:** 2026-05-22T05:02:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added TDD coverage for repeated failure normalization, threshold-2 advisor escalation, D-10 critical decision classes, D-12 human packets, D-13 dispositions, explicit retry, settings wiring, and ignored runtime artifacts.
- Implemented `.claude/hooks/advisor-failure-tracker.js` as a fail-open PostToolUse hook that stores counters in `.advisor/state/failure-signatures.json` and concise audit events in `.advisor/audit/events.jsonl`.
- Extended `.claude/hooks/advisor-gate.js` with human decision packets, disposition read/write/validation, and re-entry state that remains blocked until a valid matching disposition exists.
- Added strict draft 2020-12 schemas for decision packets, dispositions, and gate events.
- Wired `.claude/settings.json` with exactly one `advisor-failure-tracker.js` PostToolUse command while preserving existing GSD and advisor audit hooks.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests for repeated failure and full human disposition flow** - `375cfda` (test)
2. **Task 2: GREEN failure tracker, human packet, and disposition state machine** - `207c8fd` (feat)
3. **Task 3: Wire failure tracker and verify runtime artifacts stay ignored** - `7ed363f` (chore)

**Plan metadata:** pending final summary commit

## Files Created/Modified

- `.claude/advisor-mode/tests/failure-and-human-gates.test.js` - Node built-in TDD coverage for repeated failure and human disposition gates.
- `.claude/hooks/advisor-failure-tracker.js` - PostToolUse failure normalizer, threshold counter, audit writer, and consultation marker.
- `.claude/hooks/advisor-gate.js` - Human approval packet builder plus disposition persistence and re-entry validation exports.
- `.claude/advisor-mode/decision-packet.schema.json` - Strict human approval packet schema with non-null advisor recommendation.
- `.claude/advisor-mode/disposition.schema.json` - Strict approve/reject/revise/defer disposition artifact schema.
- `.claude/advisor-mode/gate-event.schema.json` - Strict gate event schema for consultation, failure, human approval, and disposition events.
- `.claude/settings.json` - Central PostToolUse wiring for the failure tracker.
- `.gitignore` - Runtime disposition artifacts ignored with `.gitkeep` exception.
- `.advisor/decisions/dispositions/.gitkeep` - Placeholder preserving the ignored runtime disposition directory.

## Decisions Made

- Repeated failure escalation does not directly block PostToolUse host execution; it records local advisory workflow state and emits context for explicit follow-up.
- Human approval packets are emitted only after `readAdvisorRecommendation` validates a matching read-only advisor artifact.
- Valid disposition artifacts satisfy local re-entry state but still require explicit retry; no code models automatic host wait-and-resume.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added tracked disposition placeholder directory**

- **Found during:** Task 3 (Wire failure tracker and verify runtime artifacts stay ignored)
- **Issue:** `.gitignore` included `.advisor/decisions/dispositions/*.json` with a `.gitkeep` exception, but the runtime disposition directory itself was absent from the repository.
- **Fix:** Added `.advisor/decisions/dispositions/.gitkeep` so ignored disposition runtime artifacts have a stable committed directory.
- **Files modified:** `.advisor/decisions/dispositions/.gitkeep`
- **Verification:** `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/init.test.js`
- **Committed in:** `7ed363f`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The fix preserves the planned ignored runtime artifact contract without changing architecture or expanding scope.

## Issues Encountered

- Initial RED test failed as expected because `advisor-failure-tracker.js` did not exist.
- During GREEN, two test expectations required correction to assert non-null recommendations and to exercise the intended camelCase host payload fields. These were fixed before the GREEN commit.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The new PostToolUse failure tracker, human packet builder, and disposition re-entry trust boundaries were already covered by T-02-10 through T-02-14.

## Verification

- `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js`
- `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/runtime-semantics.test.js`
- `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/init.test.js`
- `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/runtime-semantics.test.js .claude/advisor-mode/tests/init.test.js`
- `node --test .claude/advisor-mode/tests/*.test.js`

Final full suite result: 31 tests passed, 0 failed.

## TDD Gate Compliance

- RED commit present: `375cfda` (`test(02-03): add failing failure and human gate tests`)
- GREEN commit present after RED: `207c8fd` (`feat(02-03): implement failure and human decision gates`)
- Task 3 follow-up commit present: `7ed363f` (`chore(02-03): track disposition runtime placeholder`)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-04 can build on the completed local workflow state chain: repeated failures produce advisor consultation requirements, critical decisions require advisor recommendation before human approval, and explicit disposition artifacts gate re-entry.

## Self-Check: PASSED

- Confirmed created/modified key files exist.
- Confirmed task commits exist: `375cfda`, `207c8fd`, `7ed363f`.

---

_Phase: 02-enforced-trigger-gates_
_Completed: 2026-05-22_
