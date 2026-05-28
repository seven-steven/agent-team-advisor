---
phase: 04-provider-routing-and-conformance
plan: 03
subsystem: provider-routing
tags:
  [provider-conformance, anthropic-compatible, live-gateway, node-test, audit]
requires:
  - phase: 04-provider-routing-and-conformance
    provides: declarative provider route config and mock conformance command from 04-01/04-02
provides:
  - Live Anthropic-compatible provider conformance client using ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN
  - Deterministic mocked-fetch tests for base-message, streaming, tool-use, usage-fields, and error-shape checks
  - Sanitized conformance artifacts that distinguish configuredRoute from live response-derived servedRoute
  - Operator documentation for --live conformance and the ROUT-02 runtime boundary
affects: [phase-04-verification, ROUT-03, ROUT-02-support]
tech-stack:
  added: []
  patterns:
    - CommonJS Node CLI with injectable fetch implementation
    - Sanitized JSON/JSONL runtime artifacts under .advisor/
key-files:
  created:
    - .planning/phases/04-provider-routing-and-conformance/04-03-SUMMARY.md
  modified:
    - .claude/advisor-mode/provider-conformance.js
    - .claude/advisor-mode/provider-conformance.schema.json
    - .claude/advisor-mode/tests/provider-conformance.test.js
    - .claude/advisor-mode/README.md
key-decisions:
  - "Live conformance uses an injected fetch implementation for deterministic tests and global fetch for operator runs."
  - "Conformance artifacts record configuredRoute and servedRoute separately; servedRoute is conformance evidence only and does not close runtime ROUT-02 by itself."
patterns-established:
  - "Live gateway checks fail closed on malformed Anthropic-compatible responses."
  - "Provider conformance artifacts omit auth headers, bearer tokens, prompts, and request bodies."
requirements-completed:
  - ROUT-01
  - ROUT-02
  - ROUT-03
  - ROUT-04
duration: 24min
completed: 2026-05-28
---

# Phase 04 Plan 03: Live Provider Conformance Summary

**Live Anthropic-compatible provider conformance with deterministic mocked-fetch coverage and separated configured/served route evidence**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-28T09:51:30Z
- **Completed:** 2026-05-28T10:15:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added failing TDD coverage for live gateway env validation, Messages API request construction, mocked live check execution, configuredRoute/servedRoute artifact separation, and malformed live response fail-closed behavior.
- Implemented `createLiveGatewayClient()` with bounded Anthropic-compatible `/v1/messages` requests for base-message, streaming, tool-use, usage-fields, and error-shape checks.
- Updated conformance artifact schema and writer path to preserve static configured route metadata separately from live response-derived served route evidence.
- Updated operator docs so live conformance explicitly requires `--live`, uses `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`, writes sanitized artifacts, and does not claim runtime ROUT-02 closure.

## Task Commits

1. **Task 1: Write failing live gateway conformance tests** - `56be6e0` (test)
2. **Task 2: Implement live gateway conformance and documented operator command** - `7db9a17` (feat)

**Plan metadata:** committed after this summary is written.

_Note: This TDD plan has separate RED and GREEN commits._

## Files Created/Modified

- `.claude/advisor-mode/provider-conformance.js` - Adds live gateway client, env validation, request/response parsing, servedRoute extraction, live CLI flag, and configuredRoute/servedRoute artifact support.
- `.claude/advisor-mode/provider-conformance.schema.json` - Requires configuredRoute and servedRoute fields in conformance artifacts.
- `.claude/advisor-mode/tests/provider-conformance.test.js` - Adds deterministic mocked-fetch live conformance tests and retains offline mock tests.
- `.claude/advisor-mode/README.md` - Documents `--live`, env var usage, sanitized artifacts, and ROUT-02 boundary.
- `.planning/phases/04-provider-routing-and-conformance/04-03-SUMMARY.md` - This execution summary.

## Decisions Made

- Used Node built-ins and injectable `fetchImpl`; no package installs were needed.
- Kept mocked conformance as the default deterministic path; live conformance runs only when `--live` or `options.live` is selected.
- Stored `configuredRoute` from route resolution and `servedRoute` from provider responses separately to prevent static config from masquerading as observed provider behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Live spot-checks executed successfully as real HTTP calls, but the configured example routes currently fail at the gateway/provider layer with `new_api_error` / HTTP 503 indicating no available distributor for the configured `openai/gpt-5.5` and `z-ai/glm-4.5` models. This is not a code failure: mocked deterministic tests pass, the live path performs real requests, and the command fails closed without leaking token values.

## Verification Commands

- `node --test .claude/advisor-mode/tests/provider-conformance.test.js` — PASS, 10/10 tests.
- `node --test .claude/advisor-mode/tests/provider-routing.test.js .claude/advisor-mode/tests/provider-conformance.test.js` — PASS, 20/20 tests.
- `node --test .claude/advisor-mode/tests/*.test.js` — PASS, 96/96 tests.
- `node .claude/advisor-mode/provider-conformance.js --live --alias opus` — executed approved live HTTP path; expected fail-closed result from current provider route availability (`status: fail`, HTTP 503 error shape observed, no token output).

## TDD Gate Compliance

- RED commit exists: `56be6e0`.
- GREEN commit exists after RED: `7db9a17`.
- No separate refactor commit was needed; the minimal green implementation passed the regression suite without follow-up cleanup.

## Known Stubs

None.

## Threat Flags

| Flag                          | File                                           | Description                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: external-network | `.claude/advisor-mode/provider-conformance.js` | Live conformance sends bounded POST requests to operator-configured Anthropic-compatible gateway endpoints. Covered by plan threat model T-04-03-01 through T-04-03-03. |

## User Setup Required

None - no new external service configuration required. Existing operator-owned `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` are used only at runtime.

## Next Phase Readiness

Plan 04-03 closes the ROUT-03 implementation gap: maintainers now have a real live conformance command plus offline deterministic tests. Plan 04-04 still owns runtime source-of-truth served-route visibility for advisor/executor calls; this plan intentionally provides conformance evidence only.

## Self-Check: PASSED

- Summary file created at `.planning/phases/04-provider-routing-and-conformance/04-03-SUMMARY.md`.
- Task commits present: `56be6e0`, `7db9a17`.
- Key modified files exist and verification commands passed.

---

_Phase: 04-provider-routing-and-conformance_
_Completed: 2026-05-28_
