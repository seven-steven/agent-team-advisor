---
phase: 02-enforced-trigger-gates
plan: 02
subsystem: hooks
tags: [claude-code, prettooluse, advisor-mode, policy, tdd]

requires:
  - phase: 02-enforced-trigger-gates
    provides: Supported PreToolUse host decision and explicit retry semantics from plan 02-01
provides:
  - Policy-driven high-risk advisor consultation gate
  - Correlated request and recommendation artifact contract
  - Read-only advisor producer handoff to advisor-reviewer
  - Central PreToolUse settings wiring for Bash/Edit/Write/MultiEdit
affects: [advisor-gates, runtime-artifacts, phase-02]

tech-stack:
  added: []
  patterns:
    - CommonJS Node built-in PreToolUse hook
    - JSON Schema draft 2020-12 strict artifact contracts
    - Explicit retry after read-only advisor recommendation

key-files:
  created:
    - .claude/hooks/advisor-gate.js
    - .claude/advisor-mode/tests/advisor-consultation.test.js
    - .claude/advisor-mode/advisor-request.schema.json
    - .claude/advisor-mode/advisor-recommendation.schema.json
  modified:
    - .claude/advisor-mode/policy.example.json
    - .claude/settings.json
    - .gitignore

key-decisions:
  - "Advisor gate uses supported PreToolUse permissionDecision deny/allow fields and keeps workflow state local."
  - "Advisor recommendation producer is executor-triggered through read-only advisor-reviewer; advisor receives no mutation tools."
  - "Configured gate infrastructure failures hard-stop identifiable high-risk events instead of failing open."

patterns-established:
  - "Consultation artifacts live under .advisor/consultations and are ignored runtime state."
  - "Re-entry requires a matching recommendation with correlationKey, source read-only-advisor, and advisorAgent advisor-reviewer."

requirements-completed: [GATE-01, GATE-05, GATE-06]

duration: 19min
completed: 2026-05-22
---

# Phase 02 Plan 02: Enforced Advisor Consultation Gate Summary

**Policy-driven PreToolUse advisor gate with correlated request artifacts, read-only reviewer handoff, and validated explicit retry re-entry.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-05-22T03:42:49Z
- **Completed:** 2026-05-22T04:01:30Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added TDD coverage for high-risk Bash/Edit/Write/MultiEdit consultation, producer handoff, recommendation validation, low-risk no-op behavior, and hard-stop failure modes.
- Implemented `.claude/hooks/advisor-gate.js` as a CommonJS PreToolUse evaluator using only Node built-ins and supported host decision fields.
- Added strict request/recommendation schemas and policy data for combined tool/path/action/failure/task-state gate rules.
- Wired the advisor gate centrally for `Bash|Edit|Write|MultiEdit` while keeping `Read` outside Phase 2 escalation.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED advisor consultation producer-chain and hard-stop tests** - `aabe220` (test)
2. **Task 2: GREEN policy evaluator, request/recommendation schemas, producer handoff, and hard-stop failures** - `7d34694` (feat)
3. **Task 3: Wire PreToolUse advisor gate through central settings** - `dc43769` (feat)

**Plan metadata:** pending final summary commit

## Files Created/Modified

- `.claude/advisor-mode/tests/advisor-consultation.test.js` - Node built-in TDD coverage for consultation gate behavior and settings wiring.
- `.claude/hooks/advisor-gate.js` - Policy evaluator, request writer, recommendation validator, producer handoff builder, and hook main entrypoint.
- `.claude/advisor-mode/advisor-request.schema.json` - Strict request artifact schema.
- `.claude/advisor-mode/advisor-recommendation.schema.json` - Strict read-only recommendation artifact schema.
- `.claude/advisor-mode/policy.example.json` - Added `advisorMode.gates` policy classes and rules while preserving Phase 1 fields.
- `.claude/settings.json` - Added one PreToolUse advisor gate hook for high-risk mutation/command tools.
- `.gitignore` - Ignored generated consultation request and recommendation JSON artifacts with `.gitkeep` exceptions.

## Decisions Made

- Used `permissionDecision: "deny"` for first high-risk attempts and `permissionDecision: "allow"` only after a valid recommendation artifact exists, matching the 02-01 host contract.
- Kept malformed host payloads and missing tool names as the only fail-open cases; policy-load, classification, and request-write failures hard-stop configured matcher events.
- Kept advisor production as executor-triggered handoff to `advisor-reviewer` instead of granting advisor mutation or execution authority.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Initial settings assertion was intentionally added in Task 3 rather than Task 2 to preserve task boundaries. The RED run failed until `.claude/settings.json` was wired, then passed.

## Known Stubs

None found in modified plan files.

## Threat Flags

None beyond the plan threat model. New surfaces match planned PreToolUse hook and local runtime consultation artifact trust boundaries.

## TDD Gate Compliance

- RED commit present: `aabe220`
- GREEN commit present: `7d34694`
- Additional wiring commit present: `dc43769`

## Verification

- `node --test .claude/advisor-mode/tests/advisor-consultation.test.js` — PASS (11 tests)
- `node --test .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/init.test.js` — PASS (12 tests)
- `node --test .claude/advisor-mode/tests/*.test.js` — PASS (22 tests)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 02 can proceed to repeated-failure and human decision gate plans using the same supported PreToolUse contract, local workflow state, and explicit retry pattern.

## Self-Check: PASSED

- Created files exist: `.claude/hooks/advisor-gate.js`, `.claude/advisor-mode/tests/advisor-consultation.test.js`, `.claude/advisor-mode/advisor-request.schema.json`, `.claude/advisor-mode/advisor-recommendation.schema.json`.
- Task commits exist: `aabe220`, `7d34694`, `dc43769`.
- Required verification commands passed.

---

_Phase: 02-enforced-trigger-gates_
_Completed: 2026-05-22_
