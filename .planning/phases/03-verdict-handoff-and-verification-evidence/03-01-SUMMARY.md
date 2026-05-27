---
phase: 03-verdict-handoff-and-verification-evidence
plan: 01
subsystem: advisor-handoff
tags: [advisor-mode, context-packet, json-schema, node-test]
requires:
  - phase: 02-enforced-trigger-gates
    provides: advisor gate and read-only role boundaries
provides:
  - strict minimized advisor context packet schema
  - CommonJS context packet builder and validator exports
  - advisor prompt instructions for explicit questions and context expansion requests
affects: [phase-03-final-review, advisor-reviewer, safe-context-handoff]
tech-stack:
  added: []
  patterns:
    [
      CommonJS pure utility exports,
      Draft 2020-12 strict schema,
      Node built-in tests,
    ]
key-files:
  created:
    - .claude/advisor-mode/context-packet.schema.json
    - .claude/advisor-mode/final-review.js
    - .claude/advisor-mode/tests/context-packet.test.js
  modified:
    - .claude/agents/advisor-reviewer.md
key-decisions:
  - "Used a strict whitelist packet builder and validator with no external dependencies."
  - "Kept advisor-reviewer tools limited to Read, Grep, Glob while adding explicit question handling."
patterns-established:
  - "Minimized advisor handoff packet: changed files, relevant diff excerpts, relevant errors, explicit questions, optional verification summary."
  - "Validation rejects transcript/raw-log extras and requires at least one explicit question."
requirements-completed: [SAFE-02, VERD-01]
duration: 8min
completed: 2026-05-27
---

# Phase 03 Plan 01: Create the Phase 3 minimized advisor context-packet slice Summary

**Strict minimized advisor context packets with schema-backed validation and read-only explicit-question review instructions**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-27T06:20:43Z
- **Completed:** 2026-05-27T06:28:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added strict Draft 2020-12 schema for the minimized advisor context packet with `additionalProperties: false`.
- Added `buildContextPacket` and `validateContextPacket` CommonJS exports that whitelist compact fields and reject transcript/raw-log leakage.
- Updated the read-only advisor prompt to answer explicit questions and request specific additional context when needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED minimized context packet contract** - `8ff6838` (test)
2. **Task 2: GREEN context packet builder and advisor prompt contract** - `4c23cab` (feat)

**Plan metadata:** pending at summary creation

_Note: TDD tasks used separate RED and GREEN commits._

## Files Created/Modified

- `.claude/advisor-mode/context-packet.schema.json` - Strict minimized packet schema.
- `.claude/advisor-mode/final-review.js` - Context packet builder and validator exports.
- `.claude/advisor-mode/tests/context-packet.test.js` - Node test coverage for whitelist behavior, transcript exclusion, schema strictness, and explicit questions.
- `.claude/agents/advisor-reviewer.md` - Read-only advisor instructions for explicit questions and specific context expansion requests.

## Decisions Made

- Used built-in Node/CommonJS only, matching existing advisor-mode runtime patterns.
- Validated packet structure with a small local schema-aligned validator rather than adding package dependencies.
- Preserved the advisor read-only boundary: `tools: Read, Grep, Glob` remains unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None.

## Verification

- `node --test .claude/advisor-mode/tests/context-packet.test.js` — PASS, 5 tests passed.
- `grep -q "module.exports" .claude/advisor-mode/final-review.js && grep -q "buildContextPacket" .claude/advisor-mode/final-review.js && grep -q "validateContextPacket" .claude/advisor-mode/final-review.js` — PASS.
- `grep -q "tools: Read, Grep, Glob" .claude/agents/advisor-reviewer.md && grep -qi "explicit questions" .claude/agents/advisor-reviewer.md` — PASS.

## Self-Check: PASSED

- Created files exist: `.claude/advisor-mode/context-packet.schema.json`, `.claude/advisor-mode/final-review.js`, `.claude/advisor-mode/tests/context-packet.test.js`.
- Modified advisor file preserves read-only tools.
- Task commits exist: `8ff6838`, `4c23cab`.
- Final verification command exits 0.

## Next Phase Readiness

Ready for Phase 03 Plan 02. The minimized context-packet slice is available for downstream final-review handoff work.

---

_Phase: 03-verdict-handoff-and-verification-evidence_
_Completed: 2026-05-27_
