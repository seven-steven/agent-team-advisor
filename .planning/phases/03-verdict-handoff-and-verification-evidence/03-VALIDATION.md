---
phase: 03
slug: verdict-handoff-and-verification-evidence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                              |
| ---------------------- | -------------------------------------------------- |
| **Framework**          | Node built-in test runner (`node:test`)            |
| **Config file**        | `.claude/package.json`                             |
| **Quick run command**  | `node --test .claude/advisor-mode/tests/*.test.js` |
| **Full suite command** | `node --test .claude/advisor-mode/tests/*.test.js` |
| **Estimated runtime**  | ~10 seconds                                        |

---

## Sampling Rate

- **After every task commit:** Run `node --test .claude/advisor-mode/tests/*.test.js`
- **After every plan wave:** Run `node --test .claude/advisor-mode/tests/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                                                                           | Test Type   | Automated Command                                                      | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- | ----------- | ---------- |
| 03-01-01 | 01   | 0    | GATE-03     | T-03-01    | Completion refuses stale or missing final review for current evidence                                     | integration | `node --test .claude/advisor-mode/tests/final-review-gate.test.js`     | ❌ W0       | ⬜ pending |
| 03-01-02 | 01   | 0    | VERD-01     | T-03-02    | Verdict contract requires structured risk/confidence/findings/actions/checklist fields                    | unit/schema | `node --test .claude/advisor-mode/tests/verdict-handoff.test.js`       | ❌ W0       | ⬜ pending |
| 03-01-03 | 01   | 0    | VERD-02     | T-03-03    | Executor disposition persists accept/reject/defer per recommendation with rationale                       | unit/schema | `node --test .claude/advisor-mode/tests/disposition.test.js`           | ❌ W0       | ⬜ pending |
| 03-01-04 | 01   | 0    | AUDT-02     | T-03-04    | Verification evidence records commands, exit status, concise summaries, changed files, and residual risks | unit/schema | `node --test .claude/advisor-mode/tests/verification-evidence.test.js` | ❌ W0       | ⬜ pending |
| 03-01-05 | 01   | 0    | SAFE-02     | T-03-05    | Context packet contains only minimized whitelisted fields by default                                      | unit/schema | `node --test .claude/advisor-mode/tests/context-packet.test.js`        | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `.claude/advisor-mode/tests/final-review-gate.test.js` — covers GATE-03 freshness/final-review enforcement
- [ ] `.claude/advisor-mode/tests/verdict-handoff.test.js` — covers VERD-01 structured verdict validation
- [ ] `.claude/advisor-mode/tests/disposition.test.js` — covers VERD-02 executor disposition recording
- [ ] `.claude/advisor-mode/tests/verification-evidence.test.js` — covers AUDT-02 evidence schema and persistence
- [ ] `.claude/advisor-mode/tests/context-packet.test.js` — covers SAFE-02 minimized context packet contract
- [ ] Hook semantics spike or finalize-command fallback proof

---

## Manual-Only Verifications

| Behavior                                                                  | Requirement      | Why Manual                                                 | Test Instructions                                                                                                                                                             |
| ------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final user-facing completion packet is concise enough for decision making | GATE-03, AUDT-02 | Requires judgment on output quality and operator usability | Run a guarded completion flow and inspect that the rendered packet includes verdict summary, dispositions, evidence summary, and residual risks without full transcript spill |
| Advisor asks for more context instead of silently broadening packet scope | SAFE-02          | Needs scenario-driven interaction confirmation             | Simulate insufficient minimal packet, confirm advisor requests additional context explicitly, then resend expanded packet                                                     |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
