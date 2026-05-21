---
phase: 02
slug: enforced-trigger-gates
status: replanned
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
updated: 2026-05-21
---

# Phase 02 — Validation Strategy

> Per-phase validation contract after full replanning.

## Test Infrastructure

| Property                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Framework               | Node built-in `node:test`                          |
| Config file             | `.claude/package.json` (`type: commonjs`)          |
| Quick run command       | `node --test .claude/advisor-mode/tests/*.test.js` |
| Full suite command      | `node --test .claude/advisor-mode/tests/*.test.js` |
| Feedback latency target | < 10 seconds                                       |

## Wave Structure

| Wave | Plan  | Validation role                                                                               | Blocks                  |
| ---- | ----- | --------------------------------------------------------------------------------------------- | ----------------------- |
| 1    | 02-01 | Runtime semantics prerequisite: Claude Code blocking/wait and disposition re-entry contract   | All later Phase 2 plans |
| 2    | 02-02 | High-risk advisor consultation request, producer handoff, recommendation validation, re-entry | Plans 03 and 04         |
| 3    | 02-03 | Repeated-failure threshold 2 plus human approval packet, disposition persistence, re-entry    | Plan 04                 |
| 4    | 02-04 | Protected surfaces integrated with advisor producer and human disposition chains              | Phase completion        |

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirements              | Secure Behavior                                                                                                              | Automated Command                                                                                                                                                                     | Human/Runtime Check         | Status  |
| -------- | ---- | ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------- |
| 02-01-01 | 01   | 1    | GATE-04, GATE-06          | Runtime state machine requires blocked-pending-human and no re-entry without disposition                                     | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js`                                                                                                                    | none                        | pending |
| 02-01-02 | 01   | 1    | GATE-04, GATE-06          | Disposable hook probe implements validated disposition re-entry contract                                                     | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js`                                                                                                                    | none                        | pending |
| 02-01-03 | 01   | 1    | GATE-01, GATE-04, GATE-06 | Real Claude Code hook smoke resolves blocking/wait semantics before gate implementation                                      | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js`                                                                                                                    | Real Claude Code hook smoke | pending |
| 02-02-01 | 02   | 2    | GATE-01, GATE-05, GATE-06 | High-risk events require advisor consultation; low-risk Read remains un-escalated                                            | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js`                                                                                                                 | none                        | pending |
| 02-02-02 | 02   | 2    | GATE-01, GATE-06          | Recommendation producer chain is explicit: executor triggers read-only advisor-reviewer and persists recommendation artifact | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js`                                                                                                                 | none                        | pending |
| 02-02-03 | 02   | 2    | GATE-01, GATE-05          | PreToolUse gate is wired centrally without adding Read to escalation matcher                                                 | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/init.test.js`                                                                         | none                        | pending |
| 02-03-01 | 03   | 3    | GATE-02, GATE-04, GATE-06 | Threshold-2 repeated failure and human disposition flow tests are red before implementation                                  | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js`                                                                                                              | none                        | pending |
| 02-03-02 | 03   | 3    | GATE-02, GATE-04, GATE-06 | Failure tracker, human packet, approve/reject/revise/defer disposition persistence, and re-entry validation pass             | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/runtime-semantics.test.js` | none                        | pending |
| 02-03-03 | 03   | 3    | GATE-02                   | PostToolUse failure tracker is wired centrally and runtime state remains ignored                                             | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js .claude/advisor-mode/tests/init.test.js`                                                                      | none                        | pending |
| 02-04-01 | 04   | 4    | SAFE-04, GATE-04, GATE-06 | Protected-surface path-class-first chain tests are red before implementation                                                 | `node --test .claude/advisor-mode/tests/protected-surface.test.js`                                                                                                                    | none                        | pending |
| 02-04-02 | 04   | 4    | SAFE-04, GATE-04, GATE-06 | Protected surfaces use advisor producer and human disposition chains                                                         | `node --test .claude/advisor-mode/tests/protected-surface.test.js .claude/advisor-mode/tests/advisor-consultation.test.js .claude/advisor-mode/tests/failure-and-human-gates.test.js` | none                        | pending |
| 02-04-03 | 04   | 4    | SAFE-04                   | README and validation docs describe producer, disposition, runtime, and protected chains                                     | `node --test .claude/advisor-mode/tests/protected-surface.test.js .claude/advisor-mode/tests/scaffold-layout.test.js`                                                                 | none                        | pending |

## Sampling Rate

- After each task: run the task-specific automated command.
- After each wave: run `node --test .claude/advisor-mode/tests/*.test.js`.
- Before Phase 2 verification: run `node --test .claude/advisor-mode/tests/*.test.js` and confirm no generated `.advisor/**/*.json` or `.advisor/**/*.jsonl` runtime files are committed.

## Runtime Semantics Gate

Plan 02-01 is a required execution gate. If the real Claude Code hook smoke cannot confirm D-11 wait-for-disposition semantics, stop Phase 2 and revise plans before implementing Plans 02-04.

Acceptance contract:

- Missing disposition keeps `workflowGateStatus: "blocked-pending-human"`.
- Valid matching `approve`, `reject`, `revise`, or `defer` disposition is persisted under `.advisor/decisions/dispositions/{correlationKey}.json`.
- Re-entry reaches `workflowGateStatus: "satisfied"` only with a valid matching disposition artifact.
- Observed hook blocking mechanism is recorded in `02-RESEARCH.md` and Plan 01 summary.

## Validation Sign-Off

- [x] Every task has an automated verification command.
- [x] Runtime semantics unknown is front-loaded as Wave 1 gate.
- [x] Recommendation producer chain is test-covered in Plan 02.
- [x] Human disposition capture/persistence/re-entry is test-covered in Plan 03.
- [x] Protected surfaces reuse advisor and human chains in Plan 04.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** replanned, pending execution
