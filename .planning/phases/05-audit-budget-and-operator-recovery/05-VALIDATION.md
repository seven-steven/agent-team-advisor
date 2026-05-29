---
phase: 5
slug: audit-budget-and-operator-recovery
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Node built-in `node:test`                                                                                                                                                                        |
| **Config file**        | none — direct `.test.js` files under `.claude/advisor-mode/tests/`                                                                                                                               |
| **Quick run command**  | `node --test .claude/advisor-mode/tests/audit-log.test.js .claude/advisor-mode/tests/budget-state.test.js .claude/advisor-mode/tests/doctor.test.js .claude/advisor-mode/tests/rollback.test.js` |
| **Full suite command** | `node --test .claude/advisor-mode/tests/*.test.js`                                                                                                                                               |
| **Estimated runtime**  | ~30 seconds                                                                                                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run `node --test` for the new or touched phase-specific test file(s)
- **After every plan wave:** Run `node --test .claude/advisor-mode/tests/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                                                                                                                                     | Test Type        | Automated Command                                             | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | AUDT-01     | —          | Append-only audit events capture advisor triggers, route decisions, verdicts, and executor follow-up without rewriting history.                                     | unit/integration | `node --test .claude/advisor-mode/tests/audit-log.test.js`    | ❌ W0       | ⬜ pending |
| 05-01-02 | 01   | 1    | AUDT-03     | —          | Audit events retain `correlationKey`, `taskId`, and `sessionId` when available, and audit views can filter by them.                                                 | unit             | `node --test .claude/advisor-mode/tests/audit-log.test.js`    | ❌ W0       | ⬜ pending |
| 05-02-01 | 02   | 1    | SAFE-01     | T-05-01    | Budget policy enforces hard caps for advisor calls, tokens, and latency at task/session scope with deterministic block-or-warn results.                             | unit/integration | `node --test .claude/advisor-mode/tests/budget-state.test.js` | ❌ W0       | ⬜ pending |
| 05-03-01 | 03   | 2    | SAFE-03     | T-05-02    | Disabled and warning-only recovery modes preserve continuity without emitting strict denials for non-critical paths, while mandatory final review remains enforced. | integration      | `node --test .claude/advisor-mode/tests/rollback.test.js`     | ❌ W0       | ⬜ pending |
| 05-04-01 | 04   | 2    | SETP-02     | T-05-03    | Doctor validates hook wiring, advisor read-only permissions, provider route health, runtime paths, budget policy, and active rollback mode with actionable output.  | integration      | `node --test .claude/advisor-mode/tests/doctor.test.js`       | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `.claude/advisor-mode/tests/audit-log.test.js` — stubs and failing tests for AUDT-01 and AUDT-03
- [ ] `.claude/advisor-mode/tests/budget-state.test.js` — stubs and failing tests for SAFE-01
- [ ] `.claude/advisor-mode/tests/rollback.test.js` — stubs and failing tests for SAFE-03
- [ ] `.claude/advisor-mode/tests/doctor.test.js` — stubs and failing tests for SETP-02

---

## Manual-Only Verifications

| Behavior                                                                                             | Requirement      | Why Manual                                                                                                           | Test Instructions                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator reviews correlated audit history in a realistic local runtime after multiple hook events    | AUDT-01, AUDT-03 | Human inspection is useful to confirm the operator UX and chronology remain understandable beyond fixture assertions | Run the doctor/audit commands against a temp runtime root after executing representative hook fixtures; confirm raw event stream and correlated task/session views are both readable and consistent. |
| Operator exercises kill switch and warning-only recovery flow end-to-end with project config toggles | SAFE-03          | Needs end-to-end confirmation that documented rollback steps match actual operator workflow                          | Toggle the documented modes in `.planning/config.json`, run representative hook fixtures, and confirm strict deny vs warning-only vs disabled behavior matches documentation.                        |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
