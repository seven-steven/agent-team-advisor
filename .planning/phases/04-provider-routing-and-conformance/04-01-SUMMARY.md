---
phase: 04-provider-routing-and-conformance
plan: 01
subsystem: provider-routing
tags: [claude-code, provider-routing, hooks, audit, node-test]
requires:
  - phase: 03-verdict-handoff-and-verification-evidence
    provides: Advisor gate, final-review, runtime artifact, and verification evidence foundations
provides:
  - Strict provider route schema for semantic aliases
  - Declarative sonnet/opus/haiku provider route defaults
  - Pure CommonJS alias resolver and sanitized route audit helpers
  - Advisor consultation request routeResolution metadata
  - Executor runtime route audit hook and settings registration
affects:
  [phase-04-provider-conformance, phase-05-audit-budget-operator-recovery]
tech-stack:
  added: []
  patterns:
    - Strict draft 2020-12 JSON Schema route config
    - Metadata-only route resolution with no silent provider fallback
    - Sanitized JSON/JSONL runtime audit artifacts
key-files:
  created:
    - .claude/advisor-mode/provider-routes.example.json
    - .claude/advisor-mode/provider-routes.schema.json
    - .claude/advisor-mode/provider-routing.js
    - .claude/advisor-mode/tests/provider-routing.test.js
    - .claude/hooks/executor-route-audit.js
  modified:
    - .claude/hooks/advisor-gate.js
    - .claude/settings.json
key-decisions:
  - "Used repo-local .claude/advisor-mode provider route assets as the D-04 fallback because no plugin/skill-owned distribution mechanism exists in this repo."
  - "Stored only provider IDs, model IDs, endpoint references, and credential environment variable names; no credential values are committed."
  - "Kept route resolution metadata-only and left gate, verdict, budget, fallback, and workflow-control decisions in existing runtime layers."
patterns-established:
  - "Provider routes resolve semantic aliases through strict declarative config and return missing-route rather than selecting fallback models."
  - "Advisor and executor runtime surfaces persist sanitized requested alias plus resolved provider/model metadata by default."
requirements-completed: [ROUT-01, ROUT-02, ROUT-04]
duration: 25 min
completed: 2026-05-28
---

# Phase 04 Plan 01: Provider Route Vertical Slice Summary

**Semantic alias routing with sanitized advisor/executor provider-model visibility across real runtime audit surfaces**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-28T06:22:00Z
- **Completed:** 2026-05-28T06:47:16Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added strict `provider-routes` schema and a repo-local fallback example mapping `sonnet`, `opus`, and `haiku` to declarative provider/model targets.
- Implemented CommonJS route validation, loading, alias resolution, sanitized audit event building, and state artifact writing.
- Enriched advisor consultation requests with default `routeResolution` metadata for `opus` without logging credentials.
- Added executor runtime route audit hook registration that records sanitized `sonnet` provider/model metadata to runtime JSON and JSONL audit surfaces.
- Covered route governance, no-secret outputs, missing-route behavior, advisor request wiring, executor hook wiring, and settings registration with Node built-in tests.

## Task Commits

1. **Task 1: Verify provider IDs and route distribution mechanics** - completed in-plan with repo-local fallback decision; no separate commit because auto mode proceeded through the verification checkpoint.
2. **Task 2: Write failing route schema, resolver, advisor runtime, and executor runtime audit tests** - `9541d2c` (test)
3. **Task 3: Implement route schema, reference config, resolver, advisor metadata wiring, and executor runtime audit hook** - `e3f3aa1` (feat)

**Plan metadata:** pending final docs commit

_Note: This was a TDD plan. RED and GREEN commits are present._

## Files Created/Modified

- `.claude/advisor-mode/provider-routes.example.json` - Declarative semantic alias route defaults for `sonnet`, `opus`, and `haiku`.
- `.claude/advisor-mode/provider-routes.schema.json` - Strict draft 2020-12 route config contract.
- `.claude/advisor-mode/provider-routing.js` - Route validation, loading, alias resolution, sanitized audit event, and artifact helpers.
- `.claude/advisor-mode/tests/provider-routing.test.js` - ROUT-01/ROUT-02/ROUT-04 TDD coverage for routing and runtime visibility.
- `.claude/hooks/advisor-gate.js` - Adds `buildRuntimeRouteMetadata()` and default advisor request `routeResolution` enrichment.
- `.claude/hooks/executor-route-audit.js` - Adds executor runtime route audit artifact and JSONL recording.
- `.claude/settings.json` - Registers `executor-route-audit.js` on the PostToolUse executor runtime hook surface.

## Decisions Made

- Used repo-local `.claude/advisor-mode/` route assets as the D-04 fallback because no plugin/skill-owned distribution mechanism exists in this repo.
- Used operator-configured OpenRouter Anthropic route identifiers in the example route data and kept them declarative so maintainers can swap targets without code changes.
- Kept credentials as env var names only (`ANTHROPIC_AUTH_TOKEN`) and omitted headers, bearer tokens, prompts, responses, and request bodies from route metadata.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Redirected executor audit test runtime root to temp `.advisor` path**

- **Found during:** Task 3 (executor runtime hook verification)
- **Issue:** Existing `runtimePath()` intentionally writes runtime artifacts under `~/.claude/advisor-mode/runtime/<project-key>` unless `runtimeRoot` is supplied, while the test expected temp-root `.advisor/audit/events.jsonl`.
- **Fix:** Passed `runtimeRoot: path.join(root, '.advisor')` in the executor route audit test to keep filesystem assertions local and deterministic without changing runtime-path policy.
- **Files modified:** `.claude/advisor-mode/tests/provider-routing.test.js`
- **Verification:** `node --test .claude/advisor-mode/tests/provider-routing.test.js`
- **Committed in:** `e3f3aa1`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Kept the TDD test deterministic and filesystem-local; no product scope change.

## Issues Encountered

- `ctx7` CLI was unavailable in this environment, so current provider IDs could not be fetched through the documented CLI fallback. The plan’s operator/provider-doc checkpoint was auto-advanced by config; route defaults are recorded as declarative, operator-configured example values rather than embedded secrets.

## User Setup Required

None - no external service configuration required for this plan. Operators must still provide real gateway credentials via environment variables outside the repository before live conformance in the next plan.

## Known Stubs

None.

## Threat Flags

| Flag                      | File                                    | Description                                                                                                                 |
| ------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: runtime-hook | `.claude/hooks/executor-route-audit.js` | New PostToolUse runtime hook persists sanitized route metadata; covered by T-04-02/T-04-03 mitigations and no-secret tests. |

## Verification

- `node --test .claude/advisor-mode/tests/provider-routing.test.js` — PASS, 10/10 tests.
- `node --test .claude/advisor-mode/tests/*.test.js` — PASS, 86/86 tests.

## TDD Gate Compliance

- RED: `9541d2c test(04-01): add failing provider routing tests`
- GREEN: `e3f3aa1 feat(04-01): implement provider route resolution`
- REFACTOR: Not needed; implementation stayed minimal and full suite remained green.

## Self-Check: PASSED

- Created files exist: provider route schema, example, resolver, test, and executor hook.
- Required task commits exist: `9541d2c`, `e3f3aa1`.
- Full plan verification passed.

## Next Phase Readiness

Ready for Plan 04-02 provider conformance. The next plan can consume `provider-routing.js`, `provider-routes.example.json`, and the runtime route metadata surfaces.

---

_Phase: 04-provider-routing-and-conformance_
_Completed: 2026-05-28_
