---
phase: 02
slug: enforced-trigger-gates
status: replanned
gap_closure_plan: 02-05
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
updated: 2026-05-22
---

# Phase 02 — Validation Strategy

> Per-phase validation contract after full replanning, extended with Wave 5 gap-closure coverage for verifier-reported runtime wiring gaps.

## Test Infrastructure

| Property                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Framework               | Node built-in `node:test`                          |
| Config file             | `.claude/package.json` (`type: commonjs`)          |
| Quick run command       | `node --test .claude/advisor-mode/tests/*.test.js` |
| Full suite command      | `node --test .claude/advisor-mode/tests/*.test.js` |
| Feedback latency target | < 10 seconds                                       |

## Wave Structure

| Wave | Plan  | Validation role                                                                                                                          | Blocks                  |
| ---- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1    | 02-01 | Runtime semantics prerequisite: supported PreToolUse decision contract and explicit retry/disposition workflow model                     | All later Phase 2 plans |
| 2    | 02-02 | High-risk advisor consultation request, host-blocked first attempt, producer handoff, recommendation validation, explicit retry re-entry | Plans 03 and 04         |
| 3    | 02-03 | Repeated-failure threshold 2 plus human approval packet, disposition persistence, explicit retry, and re-entry                           | Plan 04                 |
| 4    | 02-04 | Protected surfaces integrated with advisor producer and human disposition plus explicit retry chains                                     | Phase completion        |
| 5    | 02-05 | Gap closure: persisted repeated-failure state consumed by evaluateGatePolicy, critical action human approval, and disposition retry E2E  | Phase re-verification   |

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirements                       | Secure Behavior                                                                                                                                                                               | Automated Command                                                                                                                                                                                                                          | Human/Runtime Check         | Status  |
| -------- | ---- | ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------- |
| 02-01-01 | 01   | 1    | GATE-04, GATE-06                   | Runtime tests verify supported PreToolUse decision fields and local disposition state requires explicit retry                                                                                 | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js`                                                                                                                                                                         | none                        | passed  |
| 02-01-02 | 01   | 1    | GATE-04, GATE-06                   | Disposable hook probe implements supported host decision output and explicit retry/disposition contract                                                                                       | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js`                                                                                                                                                                         | none                        | passed  |
| 02-01-03 | 01   | 1    | GATE-01, GATE-04, GATE-06          | Real Claude Code hook smoke resolves supported host semantics and records ignored custom metadata before gate implementation                                                                  | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js`                                                                                                                                                                         | Real Claude Code hook smoke | passed  |
| 02-02-01 | 02   | 2    | GATE-01, GATE-05, GATE-06          | High-risk events require advisor consultation through a host-blocked first attempt; low-risk Read remains un-escalated                                                                        | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js`                                                                                                                                                                      | none                        | passed  |
| 02-02-02 | 02   | 2    | GATE-01, GATE-06                   | Recommendation producer chain is explicit and only explicit retry after valid advisor output may proceed                                                                                      | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js`                                                                                                                                                                      | none                        | passed  |
| 02-02-03 | 02   | 2    | GATE-01, GATE-05                   | PreToolUse gate is wired centrally without adding Read to escalation matcher                                                                                                                  | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/init.test.js`                                                                                                                              | none                        | passed  |
| 02-03-01 | 03   | 3    | GATE-02, GATE-04, GATE-06          | Threshold-2 repeated failure and human disposition plus explicit retry flow tests are red before implementation                                                                               | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js`                                                                                                                                                                   | none                        | passed  |
| 02-03-02 | 03   | 3    | GATE-02, GATE-04, GATE-06          | Failure tracker, human packet, approve/reject/revise/defer disposition persistence, explicit retry, and re-entry validation pass                                                              | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/runtime-semantics.test.js`                                                      | none                        | passed  |
| 02-03-03 | 03   | 3    | GATE-02                            | PostToolUse failure tracker is wired centrally and runtime state remains ignored                                                                                                              | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/init.test.js`                                                                                                                           | none                        | passed  |
| 02-04-01 | 04   | 4    | SAFE-04, GATE-04, GATE-06          | Protected-surface path-class-first plus explicit retry chain tests are red before implementation                                                                                              | `node --test .claude/advisor-mode/tests/protected-surface.test.js`                                                                                                                                                                         | none                        | passed  |
| 02-04-02 | 04   | 4    | SAFE-04, GATE-04, GATE-06          | Protected surfaces use advisor producer and human disposition plus explicit retry chains                                                                                                      | `node --test .claude/advisor-mode/tests/protected-surface.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/failure-and-human-gates.test.js`                                                      | none                        | passed  |
| 02-04-03 | 04   | 4    | SAFE-04                            | README and validation docs describe producer, disposition, explicit retry, runtime, and protected chains                                                                                      | `node --test .claude/advisor-mode/tests/protected-surface.test.js .claude/advisor-mode/tests/scaffold-layout.test.js`                                                                                                                      | none                        | passed  |
| 02-05-01 | 05   | 5    | GATE-02, GATE-04, SAFE-04          | RED E2E coverage proves evaluateGatePolicy must read persisted tracker state, use the tracker signature key, and unlock retries                                                               | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/protected-surface.test.js`                                                                                                              | none                        | planned |
| 02-05-02 | 05   | 5    | GATE-02, GATE-04, GATE-06, SAFE-04 | Main evaluator reuses `advisor-failure-tracker.normalizeFailureSignature()`, consumes persisted counts, routes critical classes to human approval, and checks dispositions before re-blocking | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/protected-surface.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/runtime-semantics.test.js` | none                        | planned |
| 02-05-03 | 05   | 5    | GATE-02, GATE-04, GATE-06, SAFE-04 | Full regression evidence names the verifier gaps and proves exact `trackFailure()` key to `evaluateGatePolicy()` key reuse                                                                    | `node --test .claude/advisor-mode/tests/*.test.js`                                                                                                                                                                                         | none                        | planned |

## Sampling Rate

- After each task: run the task-specific automated command.
- After each wave: run `node --test .claude/advisor-mode/tests/*.test.js`.
- Before Phase 2 re-verification: run `node --test .claude/advisor-mode/tests/*.test.js` and confirm no generated `.advisor/**/*.json` or `.advisor/**/*.jsonl` runtime files are committed.

## Runtime Semantics Gate

Plan 02-01 is complete and remains a required execution gate for downstream plans. Real Claude Code 2.1.146 smoke evidence confirmed the supported `permissionDecision` contract needed by later plans: `deny` blocks with `permissionDecisionReason`, `allow` permits explicit retry after a valid matching disposition, exit-0 contextual output is non-blocking, and unsupported custom workflow metadata is not host-enforced.

Acceptance contract:

- Supported PreToolUse decision semantics used by later plans are recorded from the real runtime smoke.
- Unsupported custom workflow metadata is not treated as host enforcement.
- Missing disposition keeps local workflow state blocked and requires explicit retry after a valid artifact exists.
- Valid matching `approve`, `reject`, `revise`, or `defer` disposition is persisted under `.advisor/decisions/dispositions/{correlationKey}.json`.
- Local re-entry reaches `workflowGateStatus: "satisfied"` only with a valid matching disposition artifact.
- Observed host decision mechanism is recorded in `02-RESEARCH.md` and Plan 01 summary.

## Gap-Closure Validation Contract

Plan 02-05 must add E2E coverage for each verifier gap:

- `trackFailure()` writes a normalized signature key, and `evaluateGatePolicy()` reads that exact key using the same `normalizeFailureSignature()` implementation exported by `.claude/hooks/advisor-failure-tracker.js`.
- `evaluateGatePolicy()` consumes `.advisor/state/failure-signatures.json` without caller-injected `failureCount` and emits advisor consultation on the next matching attempt at threshold 2.
- Critical destructive, force-push, credential-control, and production-affecting classes route to `gateAction: "human-approval"` after the advisor recommendation prerequisite exists.
- `evaluateGatePolicy()` checks `evaluateHumanGateReentry()` and valid persisted dispositions before re-emitting `human_approval.required` for critical actions and protected surfaces.

## Validation Sign-Off

- [x] Every task has an automated verification command.
- [x] Runtime semantics unknown is front-loaded as Wave 1 gate.
- [x] Recommendation producer chain is test-covered in Plan 02.
- [x] Human disposition capture/persistence/re-entry is test-covered in Plan 03.
- [x] Protected surfaces reuse advisor and human chains in Plan 04.
- [x] Gap-closure Wave 5 has task-level commands for persisted repeated-failure state and evaluateGatePolicy E2E retry coverage.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** replanned with Wave 5 gap closure, pending execution
