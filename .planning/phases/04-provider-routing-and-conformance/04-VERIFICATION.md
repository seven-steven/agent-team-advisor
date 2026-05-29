---
phase: 04-provider-routing-and-conformance
verified: 2026-05-29T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "Project maintainer can run a conformance check that validates required Anthropic-compatible message, tool, streaming, and usage behaviors before enabling advisor-critical flows."
    - "User can inspect which concrete provider and model served each executor or advisor call."
  gaps_remaining: []
  regressions: []
---

# Phase 04: Provider Routing and Conformance Verification Report

**Phase Goal:** Project maintainers can map Claude semantic aliases to concrete third-party models and prove the selected gateway is safe for advisor-critical flows.
**Verified:** 2026-05-29T00:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                             | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Project maintainer can map Claude semantic aliases such as sonnet, opus, and haiku to third-party models through Anthropic-compatible provider settings.                          | ✓ VERIFIED | `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-routes.example.json` declares `sonnet`, `opus`, `haiku`; `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-routing.js` validates and resolves them; `node --test .../provider-routing.test.js` passes 17/17.                                                                                                                                                                                                                                                                                  |
| 2   | Project maintainer can configure the reference route of GLM as executor and GPT-5.5 as advisor without changing workflow logic.                                                   | ✓ VERIFIED | `provider-routes.example.json` maps `sonnet -> z-ai/glm-4.5` and `opus -> openai/gpt-5.5`; `provider-routing.test.js` asserts workflow files do not hard-code those concrete model IDs.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Project maintainer can run a conformance check that validates required Anthropic-compatible message, tool, streaming, and usage behaviors before enabling advisor-critical flows. | ✓ VERIFIED | `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-conformance.js` contains live-path env resolution (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`), real `/v1/messages` fetch calls, and check runners for `base-message`, `streaming`, `tool-use`, `usage-fields`, and `error-shape`; `provider-conformance.test.js` passes 10/10; CLI `--live` is implemented and fail-closed.                                                                                                                                                                                                       |
| 4   | User can inspect which concrete provider and model served each executor or advisor call.                                                                                          | ✓ VERIFIED | Phase 04’s revised contract is implemented exactly as requested: configured route identity uses `configuredProvider` / `configuredModel`; runtime-observed model uses `response.body.model` only; entrypoint identity uses `providerAlias` / `endpointAlias`; no fabricated `observedProvider` / `servedProvider` field is emitted. Advisor wiring is in `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/advisor-gate.js`; executor wiring is in `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/executor-route-audit.js`; `provider-routing.test.js` covers both surfaces. |

**Score:** 4/4 truths verified

### User Flow Coverage

| #   | User Flow Step                                                              | Expected                                                                                                 | Evidence in Codebase                                                                                                 | Status     |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Maintainer edits semantic alias routes                                      | Alias-to-provider/model mapping is declarative and validated                                             | `provider-routes.example.json`, `provider-routes.schema.json`, `provider-routing.js`                                 | ✓ VERIFIED |
| 2   | Maintainer keeps workflow logic alias-based while changing concrete targets | GLM executor and GPT-5.5 advisor are configured in route data, not workflow logic                        | `provider-routes.example.json`; test `ROUT-04 workflow modules stay declarative...`                                  | ✓ VERIFIED |
| 3   | Maintainer runs conformance before trusting a gateway route                 | Live mode performs real Anthropic-compatible requests; mock mode remains for deterministic offline tests | `provider-conformance.js`, `provider-conformance.test.js`, README `--live` and `--mock` docs                         | ✓ VERIFIED |
| 4   | Operator inspects route evidence for advisor/executor calls                 | Configured route and runtime-observed model are separate; source field is explicit                       | `advisor-gate.js`, `executor-route-audit.js`, `provider-routing.js`, tests for `response.body.model` source-of-truth | ✓ VERIFIED |

### Required Artifacts

| Artifact                                                                                                            | Expected                                         | Status     | Details                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-routes.schema.json`        | Strict semantic route schema                     | ✓ VERIFIED | Draft 2020-12, `additionalProperties: false`, required route fields enforced.                                                                                                                  |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-routes.example.json`       | Declarative sonnet/opus/haiku routes             | ✓ VERIFIED | Contains GLM executor and GPT-5.5 advisor defaults plus required conformance sets.                                                                                                             |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-routing.js`                | Route resolution and runtime route normalization | ✓ VERIFIED | Implements `validateRouteConfig`, `loadRouteConfig`, `resolveRoute`, `normalizeServedRoute`, `assertServedRouteSourceAvailable`, `buildResolvedRouteAuditEvent`, `writeResolvedRouteArtifact`. |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/advisor-gate.js`                           | Advisor artifact route metadata wiring           | ✓ VERIFIED | `buildRuntimeRouteMetadata()` adds configured route fields; `buildAdvisorObservedRoute()` reads only `advisorRecommendation.providerResponse.body.model`.                                      |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/executor-route-audit.js`                   | Executor runtime route audit wiring              | ✓ VERIFIED | `buildExecutorRouteAuditEvent()` / `recordExecutorRouteResolution()` record configured route plus runtime `observedModel` from `input.providerResponse.body.model`.                            |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/settings.json`                                   | Runtime hook registration                        | ✓ VERIFIED | Registers `executor-route-audit.js` on `PostToolUse` for executor tool surfaces.                                                                                                               |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-conformance.schema.json`   | Strict conformance artifact contract             | ✓ VERIFIED | Requires top-level artifact metadata plus per-route `configuredRoute`, `servedRoute`, and check results.                                                                                       |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-conformance.js`            | Live and mock conformance command                | ✓ VERIFIED | Live client, fetch-based Messages API path, fail-closed checks, artifact writing, CLI args.                                                                                                    |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/provider-routing.test.js`     | Routing and ROUT-02 contract tests               | ✓ VERIFIED | 17 passing tests including static-source rejection and runtime `response.body.model` wiring.                                                                                                   |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/provider-conformance.test.js` | Conformance tests                                | ✓ VERIFIED | 10 passing tests covering live request construction, mock mode, malformed live failure, artifact safety.                                                                                       |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/README.md`                          | Operator docs for live vs mock conformance       | ✓ VERIFIED | Explicit `--live` and `--mock` commands; documents ROUT-02 boundary accurately.                                                                                                                |

### Key Link Verification

| From                      | To                                         | Via                                                         | Status  | Details                                                                                                                                               |
| ------------------------- | ------------------------------------------ | ----------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | --------- | ----- | ------ |
| `provider-routing.js`     | `provider-routes.schema.json`              | schema-backed validation                                    | ✓ WIRED | `validateRouteConfig()` enforces the same strict shape the schema documents.                                                                          |
| `advisor-gate.js`         | `provider-routing.js`                      | `buildRuntimeRouteMetadata()` + `normalizeServedRoute()`    | ✓ WIRED | Advisor artifacts include configured route data and optional observed runtime model sourced from `advisorRecommendation.providerResponse.body.model`. |
| `executor-route-audit.js` | `provider-routing.js`                      | `buildExecutorRouteAuditEvent()` + `normalizeServedRoute()` | ✓ WIRED | Executor runtime artifacts use `hookEvent.providerResponse.body.model` as the only accepted observed-model source.                                    |
| `settings.json`           | `executor-route-audit.js`                  | `PostToolUse` hook registration                             | ✓ WIRED | Hook is registered for `Bash                                                                                                                          | Edit | Write | MultiEdit | Agent | Task`. |
| `provider-conformance.js` | selected gateway `/v1/messages` endpoint   | `createLiveGatewayClient()` fetch POST                      | ✓ WIRED | Live mode resolves env vars, normalizes base URL, and sends real Messages API requests.                                                               |
| `provider-conformance.js` | `.advisor/state/provider-conformance.json` | `writeConformanceArtifacts()`                               | ✓ WIRED | Latest conformance artifact persisted.                                                                                                                |
| `provider-conformance.js` | `.advisor/audit/events.jsonl`              | `writeConformanceArtifacts()` append                        | ✓ WIRED | Appends `provider_conformance.completed` JSONL events.                                                                                                |

### Data-Flow Trace (Level 4)

| Artifact                  | Data Variable                 | Source                                                          | Produces Real Data                                                                       | Status    |
| ------------------------- | ----------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- |
| `provider-conformance.js` | `servedRoute.model`           | Live gateway response body `model` or message start event model | Yes in live mode; deterministic mock path preserved for offline tests                    | ✓ FLOWING |
| `advisor-gate.js`         | `observedRoute.observedModel` | `advisorRecommendation.providerResponse.body.model`             | Yes, when runtime provider response metadata is present; otherwise explicitly unobserved | ✓ FLOWING |
| `executor-route-audit.js` | `observedRoute.observedModel` | `hookEvent.providerResponse.body.model`                         | Yes, when runtime provider response metadata is present; otherwise explicitly unobserved | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                          | Command                                                                                                                                                                                                                                       | Result                                                                                            | Status |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| ROUT-01/02/04 routing contract    | `node --test /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/provider-routing.test.js`                                                                                                                   | 17/17 pass                                                                                        | ✓ PASS |
| ROUT-03 conformance contract      | `node --test /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/provider-conformance.test.js`                                                                                                               | 10/10 pass                                                                                        | ✓ PASS |
| Phase 4 regression                | `node --test /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/provider-routing.test.js /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/provider-conformance.test.js` | 27/27 pass                                                                                        | ✓ PASS |
| Full advisor-mode regression      | `node --test /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/*.test.js`                                                                                                                                  | 103/103 pass                                                                                      | ✓ PASS |
| Mock conformance CLI              | `node /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-conformance.js --root /home/seven/data/coding/projects/seven/agent-team-advisor --mock pass --alias opus`                                       | Emits `{"event":"provider_conformance.completed","status":"pass","routes":1}`                     | ✓ PASS |
| Live conformance fail-closed path | `node /home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/provider-conformance.js --root /home/seven/data/coding/projects/seven/agent-team-advisor --live --alias opus`                                            | Exits 1 with `status:"fail"`; live path is callable and fails closed rather than passing silently | ✓ PASS |

### Probe Execution

| Probe           | Command | Result                                                                          | Status |
| --------------- | ------- | ------------------------------------------------------------------------------- | ------ |
| none discovered | n/a     | No `scripts/*/tests/probe-*.sh` found and phase artifacts do not declare probes | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan                                       | Description                                                                             | Status      | Evidence                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROUT-01     | `04-01-PLAN.md`                                   | Maintainer can map semantic aliases through Anthropic-compatible provider settings      | ✓ SATISFIED | Route schema/example/resolver implemented and tested.                                                                                                                                                                   |
| ROUT-02     | `04-01-PLAN.md`, `04-02-PLAN.md`, `04-04-PLAN.md` | User can inspect which concrete provider and model served each executor or advisor call | ✓ SATISFIED | Revised contract implemented: configured route via `configuredProvider/configuredModel`, runtime model via `response.body.model`, route identity via `providerAlias/endpointAlias`, no invented runtime provider field. |
| ROUT-03     | `04-02-PLAN.md`, `04-03-PLAN.md`                  | Maintainer can run advisor-critical gateway conformance before enablement               | ✓ SATISFIED | Live fetch path, required checks, artifact writing, and fail-closed CLI are implemented and tested.                                                                                                                     |
| ROUT-04     | `04-01-PLAN.md`, `04-02-PLAN.md`                  | GLM executor and GPT-5.5 advisor route remain configurable without workflow changes     | ✓ SATISFIED | Declarative mapping present; tests assert workflow files do not hard-code concrete IDs.                                                                                                                                 |

**Orphaned requirements:** none.

### Anti-Patterns Found

| File | Line | Pattern                                                                                                          | Severity | Impact                                                 |
| ---- | ---- | ---------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| none | n/a  | No blocking debt markers (`TBD`/`FIXME`/`XXX`) or placeholder implementations found in phase-critical code files | INFO     | No anti-pattern blocker observed for Phase 04 closure. |

### Human Verification Required

None. The phase contract verified here is implementation capability: maintainers can configure routes, run live conformance, and inspect the Phase 04 route/audit contract in code and tests. Operator-specific gateway pass/fail remains an execution-time use of the conformance command, not a missing implementation capability.

### Gaps Summary

Previous gaps are closed.

What changed in code, not just in summaries:

1. `provider-conformance.js` is no longer mock-only. It now has a real live gateway path using `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, fetch POSTs to `/v1/messages`, and required advisor-critical checks.
2. ROUT-02 no longer pretends static route config equals runtime truth. The implementation now separates:
   - `configuredProvider` / `configuredModel` for configured route intent
   - `observedModel` from real runtime `response.body.model`
   - `providerAlias` / `endpointAlias` for ingress identity
3. The code does not fabricate `observedProvider` / `servedProvider`. That matches the revised Phase 04 contract and avoids the earlier false claim of runtime provider observability when only runtime model evidence exists.

Conclusion: Phase 04’s actual shipped contract is present, wired, tested, and fail-closed. The phase goal is achieved under the revised ROUT-02 semantics explicitly encoded in the implementation and tests.

---

_Verified: 2026-05-29T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
