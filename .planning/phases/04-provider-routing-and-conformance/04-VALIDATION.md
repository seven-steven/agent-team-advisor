---
phase: 04
slug: provider-routing-and-conformance
status: ready
nyquist_compliant: true
wave_0_design_complete: true
implementation_complete: false
created: 2026-05-28
updated: 2026-05-28
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Node built-in `node:test`                                                                                                 |
| **Config file**        | none detected                                                                                                             |
| **Quick run command**  | `node --test .claude/advisor-mode/tests/provider-routing.test.js .claude/advisor-mode/tests/provider-conformance.test.js` |
| **Full suite command** | `node --test .claude/advisor-mode/tests/*.test.js`                                                                        |
| **Estimated runtime**  | ~30 seconds                                                                                                               |

---

## Sampling Rate

- **After every task commit:** Run the task-specific command listed in the Per-Task Verification Map.
- **After every plan wave:** Run `node --test .claude/advisor-mode/tests/*.test.js`.
- **Before `/gsd:verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement               | Threat Ref                         | Secure Behavior                                                                                                                                                                                                                                                  | Test Type                               | Automated Command                                                                                                         | File Exists / Dependency State                             | Status  |
| -------- | ---- | ---- | ------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| 04-01-01 | 01   | 1    | ROUT-01, ROUT-04          | T-04-01                            | Provider/model IDs and route distribution mechanics are verified without committing secrets                                                                                                                                                                      | human gate                              | N/A — blocking human/provider-doc checkpoint before tests are created                                                     | N/A                                                        | pending |
| 04-01-02 | 01   | 1    | ROUT-01, ROUT-02, ROUT-04 | T-04-01, T-04-02, T-04-03          | Failing tests define strict alias resolution, protected route governance, audit-safe metadata, real advisor consultation request wiring, and real executor runtime hook audit wiring for ROUT-02                                                                 | unit / schema / integration             | `node --test .claude/advisor-mode/tests/provider-routing.test.js`                                                         | Created by this task                                       | pending |
| 04-01-03 | 01   | 1    | ROUT-01, ROUT-02, ROUT-04 | T-04-01, T-04-02, T-04-03          | Alias routes resolve semantic aliases to declarative provider/model targets; `advisor-gate.js` request artifacts carry sanitized advisor `routeResolution`; `executor-route-audit.js` writes sanitized executor-call route artifacts and audit events by default | unit / schema / integration             | `node --test .claude/advisor-mode/tests/provider-routing.test.js`                                                         | Depends on 04-01-02 test file                              | pending |
| 04-02-01 | 02   | 2    | ROUT-03, ROUT-04          | T-04-04, T-04-06                   | Live gateway docs/env/request shapes are confirmed before implementation without committing credentials                                                                                                                                                          | human gate                              | N/A — blocking human/provider-doc checkpoint before conformance tests are created                                         | N/A                                                        | pending |
| 04-02-02 | 02   | 2    | ROUT-02, ROUT-03          | T-04-04, T-04-05, T-04-06, T-04-07 | Failing tests define targeted conformance checks, failure behavior, and sanitized provider/model artifacts                                                                                                                                                       | unit with mocked gateway                | `node --test .claude/advisor-mode/tests/provider-conformance.test.js`                                                     | Created by this task; depends on 04-01 outputs             | pending |
| 04-02-03 | 02   | 2    | ROUT-02, ROUT-03, ROUT-04 | T-04-04, T-04-05, T-04-06, T-04-07 | Conformance command writes route-aware state/audit artifacts and exits non-zero on unsupported advisor-critical behavior                                                                                                                                         | unit with mocked gateway + manual smoke | `node --test .claude/advisor-mode/tests/provider-routing.test.js .claude/advisor-mode/tests/provider-conformance.test.js` | Depends on 04-02-02 test file and 04-01 route/runtime code | pending |

_Status vocabulary: pending · green · red · flaky_

---

## ROUT-02 Executor Route Visibility Verification

| Surface                                  | Plan Task          | What Must Be Verified                                                                                                                                                                                                                                                                         | Verification Method                                                                                                                             |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/hooks/executor-route-audit.js`  | 04-01-02, 04-01-03 | The real executor runtime hook resolves `sonnet` through provider routes and emits `requestedAlias`, `resolvedProvider`, `resolvedModel`, `endpointRef`, `routeConfigPath`, and `conformanceStatus` without prompts, responses, headers, request bodies, bearer tokens, or credential values. | Automated: `node --test .claude/advisor-mode/tests/provider-routing.test.js`                                                                    |
| `.advisor/runtime/executor-calls/*.json` | 04-01-03           | Each executor-call artifact records the concrete provider/model serving the executor route and includes `event: "provider_route.executor_call"`.                                                                                                                                              | Automated filesystem assertion in provider-routing tests using a temp `.advisor/runtime/executor-calls/` root.                                  |
| `.advisor/audit/events.jsonl`            | 04-01-03           | Executor runtime hook appends a sanitized `provider_route.executor_call` audit event, separate from advisor consultation artifacts and conformance artifacts.                                                                                                                                 | Automated JSONL assertion in provider-routing tests using a temp audit path.                                                                    |
| `.claude/settings.json`                  | 04-01-02, 04-01-03 | Project settings register `executor-route-audit.js` on the Claude Code lifecycle surface used for actual executor runtime turns in this repo.                                                                                                                                                 | Automated settings assertion in provider-routing tests; human review only if the executor lifecycle surface is ambiguous during implementation. |

---

## Wave 0 Design Requirements

Wave 0 is a design contract, not a claim that implementation artifacts already exist. The phase is execution-ready because every missing automated target is created by an earlier task in the same plan before any later task depends on it.

- 04-01-02 creates `.claude/advisor-mode/tests/provider-routing.test.js` before 04-01-03 runs it as a green check.
- 04-02-02 creates `.claude/advisor-mode/tests/provider-conformance.test.js` before 04-02-03 runs it as a green check.
- Human/provider-doc checkpoints 04-01-01 and 04-02-01 use `<human-check>` only; they do not reference test files that do not exist yet.
- 04-01-03 creates `.claude/advisor-mode/provider-routes.schema.json`, `.claude/advisor-mode/provider-routes.example.json`, `.claude/advisor-mode/provider-routing.js`, runtime metadata wiring in `.claude/hooks/advisor-gate.js`, executor runtime route auditing in `.claude/hooks/executor-route-audit.js`, and hook registration in `.claude/settings.json`.
- 04-02-03 creates `.claude/advisor-mode/provider-conformance.schema.json`, `.claude/advisor-mode/provider-conformance.js`, README operator docs, `.advisor/state/provider-conformance.json` writes, and `.advisor/audit/events.jsonl` append behavior.

---

## Manual-Only Verifications

| Behavior                                                                                                          | Requirement | Why Manual                                                                                                                                                      | Test Instructions                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live provider route resolves GLM executor and GPT-5.5 advisor through the configured Anthropic-compatible gateway | ROUT-04     | Exact provider/model IDs and gateway env syntax must come from current provider docs or operator-owned gateway configuration                                    | Verify current provider docs, configure env vars outside the repo, run conformance command against the live gateway, confirm artifact records requested alias plus resolved provider/model |
| Live gateway passes advisor-critical conformance checks with expected error shape and usage fields                | ROUT-03     | Provider-specific behavior can drift; deterministic unit tests use mocked gateway behavior, while live compatibility needs a human-owned credentialed smoke run | Run the conformance command against the chosen gateway, inspect per-check results, and fail the phase if any critical check is unsupported or only partially compatible                    |

---

## Validation Sign-Off

- [x] All executable tasks have `<automated>` verify, and checkpoint tasks use `<human-check>` only.
- [x] Sampling continuity: no 3 consecutive implementation tasks without automated verify.
- [x] Wave 0 design covers all missing automated references before they are consumed.
- [x] No watch-mode flags.
- [x] Feedback latency target < 30s.
- [x] `nyquist_compliant: true` set in frontmatter.
- [x] Per-task map references only existing plans 04-01 and 04-02.
- [x] ROUT-02 verification covers both advisor-call route visibility and executor-call route visibility on real runtime/audit surfaces.

**Approval:** ready-for-execution
