---
phase: 01-repo-scoped-advisor-foundation
plan: 01
subsystem: infra
tags: [claude-code, advisor-mode, hooks, scaffold, node-test]

requires: []
provides:
  - repo-scoped Advisor Mode scaffold command
  - read-only advisor and executor guidance agent assets
  - baseline hook wiring and runtime placeholder directories
affects:
  [
    phase-2-enforced-trigger-gates,
    phase-3-verdict-handoff,
    phase-5-audit-budget,
  ]

tech-stack:
  added: []
  patterns:
    - CommonJS zero-dependency local scaffold command
    - idempotent Claude settings hook merge by command path
    - runtime artifacts ignored under .advisor while .gitkeep files remain tracked

key-files:
  created:
    - .claude/advisor-mode/init.js
    - .claude/advisor-mode/tests/init.test.js
    - .claude/agents/advisor-reviewer.md
    - .claude/agents/executor-guidance.md
    - .claude/hooks/advisor-boundary-check.js
    - .claude/hooks/advisor-install-audit.js
    - .claude/advisor-mode/policy.example.json
    - .claude/advisor-mode/verdict.schema.json
    - .advisor/audit/.gitkeep
    - .advisor/state/.gitkeep
    - .gitignore
  modified:
    - .claude/settings.json

key-decisions:
  - "Used a zero-dependency CommonJS scaffold to match existing .claude/package.json and avoid package install risk."
  - "Registered Phase 1 advisor hooks as fail-open command hooks while preserving all existing gsd hook entries."

patterns-established:
  - "Advisor agent frontmatter uses model alias opus with only Read, Grep, and Glob tools."
  - "Scaffold-created runtime artifacts live under .advisor and generated JSONL/state files are ignored."

requirements-completed: [AGNT-01, AGNT-02, AGNT-03, SETP-01]

duration: 6min
completed: 2026-05-19
---

# Phase 1 Plan 1: Repo-Scoped Advisor Foundation Summary

**Zero-dependency Advisor Mode scaffold with read-only opus advisor assets, idempotent hook wiring, and ignored .advisor runtime placeholders**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-19T11:40:25Z
- **Completed:** 2026-05-19T11:45:48Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added a Node/CommonJS scaffold command exporting `main` and `scaffoldAdvisorMode` that writes the repo-local Advisor Mode foundation under a chosen root.
- Added an end-to-end `node:test` regression covering idempotent scaffold behavior, settings preservation, read-only advisor tools, and runtime ignore rules.
- Created advisor/executor role assets, non-blocking Phase 1 hook placeholders, policy/schema examples, `.advisor` runtime placeholders, and `.gitignore` rules for generated runtime files.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED scaffold end-to-end test** - `0538bc5` (test)
2. **Task 2: GREEN scaffold command and baseline assets** - `18777f9` (feat)
3. **Task 3: REFACTOR scaffold internals without changing behavior** - `1051d8f` (refactor)

## Files Created/Modified

- `.claude/advisor-mode/tests/init.test.js` - end-to-end scaffold regression using Node built-in test APIs.
- `.claude/advisor-mode/init.js` - idempotent scaffold command and exported API.
- `.claude/agents/advisor-reviewer.md` - read-only advisor subagent using `model: opus` and `tools: Read, Grep, Glob`.
- `.claude/agents/executor-guidance.md` - executor authority guidance preserving workspace mutation ownership.
- `.claude/hooks/advisor-boundary-check.js` - fail-open Phase 1 boundary hook placeholder.
- `.claude/hooks/advisor-install-audit.js` - fail-open Phase 1 install audit hook placeholder.
- `.claude/advisor-mode/policy.example.json` - versioned baseline policy example.
- `.claude/advisor-mode/verdict.schema.json` - JSON Schema for verdict-first advisor output.
- `.claude/settings.json` - preserved existing GSD hooks and added Advisor Mode command hooks once.
- `.advisor/audit/.gitkeep` - trackable runtime audit directory placeholder.
- `.advisor/state/.gitkeep` - trackable runtime state directory placeholder.
- `.gitignore` - ignores generated `.advisor` JSONL/state artifacts while keeping placeholders trackable.

## Decisions Made

- Used Node built-ins only, matching the plan’s zero-new-dependency requirement and avoiding package legitimacy risk.
- Kept Phase 1 hooks non-blocking and advisory; high-risk gate blocking, provider routing, budgets, and hosted services remain deferred to later roadmap phases.
- Wrote generated policy/schema examples under `.claude/advisor-mode` and runtime placeholders under `.advisor` to preserve the versioned/runtime split.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed refactor regression in `.gitignore` merge**

- **Found during:** Task 3 (REFACTOR scaffold internals without changing behavior)
- **Issue:** The initial refactor accidentally removed the `existing` variable in `mergeGitignore`, causing the scaffold test to fail with `existing is not defined`.
- **Fix:** Restored the existing `.gitignore` read before applying the shared rule list.
- **Files modified:** `.claude/advisor-mode/init.js`
- **Verification:** `node --test .claude/advisor-mode/tests/init.test.js`
- **Committed in:** `1051d8f`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** No scope change; the auto-fix was required to preserve refactor behavior.

## Issues Encountered

- The RED test failed for the expected missing `init.js` module before implementation.
- A generated config diff from planning state loading was detected and restored before any implementation commit; shared orchestrator artifacts were not committed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None found in files created or modified by this plan.

## Threat Flags

| Flag                               | File                           | Description                                                                                                                             |
| ---------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: hook-settings-surface | `.claude/settings.json`        | Added repo-local Advisor Mode hook command registrations. Covered by plan threat T-01-01 and T-01-04.                                   |
| threat_flag: filesystem-scaffold   | `.claude/advisor-mode/init.js` | Adds a maintainer CLI that writes project-local files under a caller-supplied root. Covered by plan trust boundary and T-01-01/T-01-03. |

## TDD Gate Compliance

- RED commit present: `0538bc5` (`test(01-01): add failing scaffold test`)
- GREEN commit present after RED: `18777f9` (`feat(01-01): implement advisor scaffold skeleton`)
- REFACTOR commit present after GREEN: `1051d8f` (`refactor(01-01): simplify scaffold internals`)

## Verification

- `node --test .claude/advisor-mode/tests/init.test.js` — passed.
- `grep -v '^#' .claude/agents/advisor-reviewer.md | grep -E 'tools: Read, Grep, Glob'` — passed.
- `grep -v '^#' .claude/agents/advisor-reviewer.md | grep -E 'Bash|Write|Edit|MultiEdit' && exit 1 || exit 0` — passed.

## Next Phase Readiness

Phase 2 can build enforced trigger gates on top of the scaffolded hook locations, advisor agent boundary, and `.advisor` runtime directory split.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/01-repo-scoped-advisor-foundation/01-01-SUMMARY.md`.
- Task commits found: `0538bc5`, `18777f9`, `1051d8f`.
- Final scaffold test passed with `node --test .claude/advisor-mode/tests/init.test.js`.

---

_Phase: 01-repo-scoped-advisor-foundation_
_Completed: 2026-05-19_
