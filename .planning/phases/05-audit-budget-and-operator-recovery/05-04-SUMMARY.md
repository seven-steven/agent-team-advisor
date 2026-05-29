---
phase: 05-audit-budget-and-operator-recovery
plan: 04
subsystem: doctor-validation
tags: [node, commonjs, doctor, validation, audit, runtime, tdd]
requires:
  - phase: 05-audit-budget-and-operator-recovery
    plan: 01
    provides: append-only sanitized audit writer and runtime audit views
  - phase: 05-audit-budget-and-operator-recovery
    plan: 02
    provides: budget policy loader and runtime budget state paths
  - phase: 05-audit-budget-and-operator-recovery
    plan: 03
    provides: operator recovery mode reader and rollback controls
provides:
  - read-only Advisor Mode doctor CLI and check runner
  - nine operator-facing validation checks with repair guidance
  - sanitized doctor.completed audit and state artifacts
  - README usage instructions for doctor flags and check IDs
affects:
  [
    operator-validation,
    setup-doctor,
    audit,
    budget-state,
    recovery-mode,
    provider-conformance,
  ]
tech-stack:
  added: []
  patterns:
    - CommonJS executable CLI with exported runDoctor, runDoctorCheck, buildDoctorArtifact, and main
    - runtimePath(root, ['state', 'doctor.json']) for latest doctor state
    - appendAuditEvent for sanitized doctor.completed evidence
key-files:
  created:
    - .claude/advisor-mode/doctor.js
    - .claude/advisor-mode/tests/doctor.test.js
  modified:
    - .claude/advisor-mode/README.md
key-decisions:
  - "Doctor defaults to offline/read-only validation and uses existing provider conformance state instead of making live provider calls."
  - "Doctor writes only runtime audit/state evidence while tests compare protected project assets before and after execution."
  - "Each doctor check returns status, summary, and repair guidance so failed checks are operator-actionable."
patterns-established:
  - "Doctor check runner map keeps each validation surface independently testable through runDoctorCheck."
  - "CLI status follows aggregate doctor status: pass exits 0, fail/error exits 1, while always printing sanitized JSON when checks complete."
requirements-completed: [SETP-02]
duration: 7min
completed: 2026-05-29T06:24:31Z
---

# Phase 05 Plan 04: Doctor/Validation Vertical Slice Summary

**Read-only Advisor Mode doctor validates hooks, advisor permissions, provider route/conformance state, runtime paths, audit stream, budget policy, and recovery mode with repair guidance.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-29T06:17:50Z
- **Completed:** 2026-05-29T06:24:31Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `.claude/advisor-mode/doctor.js` with `runDoctor`, `runDoctorCheck`, `buildDoctorArtifact`, and `main` exports.
- Implemented nine checks: `install.assets`, `hooks.wiring`, `advisor.permissions`, `provider.routes`, `provider.conformance`, `runtime.paths`, `audit.raw_stream`, `budget.policy`, and `recovery.mode`.
- Added Node `node:test` coverage for check IDs, pass/fail status, repair guidance, CLI behavior, read-only protected assets, audit append, state artifact write, stable exports, README coverage, and no-secret output.
- Documented doctor usage in `.claude/advisor-mode/README.md`, including `--json`, `--pretty`, `--root`, `--runtime-root`, `--smoke`, runtime artifacts, and every check ID.

## Task Commits

1. **Task 1: RED doctor command tests** - `7bc14e1` (test)
2. **Task 2: GREEN doctor implementation and CLI** - `d88b3c5` (feat)
3. **Task 3: Document doctor usage and refactor checks** - `da6cb8c` (docs)

## Files Created/Modified

- `.claude/advisor-mode/doctor.js` - Read-only doctor check runner and CLI.
- `.claude/advisor-mode/tests/doctor.test.js` - TDD coverage for doctor artifacts, checks, CLI, protected file non-mutation, no-secret output, README docs, and stable exports.
- `.claude/advisor-mode/README.md` - Operator-facing doctor validation instructions and check ID table.

## Decisions Made

- Used existing `loadRouteConfig`, `loadBudgetPolicy`, `readOperatorMode`, `appendAuditEvent`, and `runtimePath` helpers instead of introducing new dependencies.
- Kept provider smoke behavior offline by default: doctor checks existing conformance state and points operators to provider conformance for live/mock refresh.
- Wrote doctor evidence to runtime state/audit only; project assets remain read-only during doctor execution.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The executor environment does not expose `/code-review` and `/simplify` as callable tools. Manual focused review/simplification was performed on only `.claude/advisor-mode/doctor.js`, `.claude/advisor-mode/tests/doctor.test.js`, and `.claude/advisor-mode/README.md`.
- A full `node --test .claude/advisor-mode/tests/*.test.js` run showed four pre-existing failures outside Plan 05-04 scope in earlier test areas: advisor consultation correlation prefixes, executor decision event name, protected-surface disposition path prefix, and verification evidence event name. Targeted plan verification passed.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. Doctor reads local config/agent files and writes runtime audit/state artifacts as covered by T-05-10 through T-05-12.

## User Setup Required

None - no external service configuration or package install required.

## Verification

- `node --test .claude/advisor-mode/tests/doctor.test.js` (RED failed before implementation because `.claude/advisor-mode/doctor.js` was missing)
- `node --test .claude/advisor-mode/tests/doctor.test.js .claude/advisor-mode/tests/provider-conformance.test.js` (PASS, 16/16 tests)
- `node .claude/advisor-mode/doctor.js --json` (printed JSON containing `"event":"doctor.completed"`; exited `1` in this worktree because current runtime lacks a passing provider conformance state artifact)

## TDD Gate Compliance

- RED commit present: `7bc14e1`
- GREEN commit present after RED: `d88b3c5`
- Documentation/refactor commit present after GREEN: `da6cb8c`
- Manual focused refactor/review was completed because `/code-review` and `/simplify` slash commands are not exposed as tools in this executor environment.

## Next Phase Readiness

- SETP-02 is implemented for Phase 5: operators can run one doctor command for installation/runtime health and receive actionable per-check repair guidance.
- No blockers remain for Phase 05 completion verification.

## Self-Check: PASSED

- Created files exist: `.claude/advisor-mode/doctor.js`, `.claude/advisor-mode/tests/doctor.test.js`.
- Modified README contains `Doctor validation`, `node .claude/advisor-mode/doctor.js --json`, and all nine check IDs.
- Task commits exist: `7bc14e1`, `d88b3c5`, `da6cb8c`.
- Final targeted verification command passed with 16/16 tests.

---

_Phase: 05-audit-budget-and-operator-recovery_
_Completed: 2026-05-29T06:24:31Z_
