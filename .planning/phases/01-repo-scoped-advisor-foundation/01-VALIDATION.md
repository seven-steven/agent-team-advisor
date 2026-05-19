---
phase: 1
slug: repo-scoped-advisor-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                           |
| ---------------------- | ------------------------------- |
| **Framework**          | Node.js built-in test runner    |
| **Config file**        | none — use native `node --test` |
| **Quick run command**  | `node --test`                   |
| **Full suite command** | `node --test`                   |
| **Estimated runtime**  | ~10 seconds                     |

---

## Sampling Rate

- **After every task commit:** Run `node --test`
- **After every plan wave:** Run `node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                                   | Test Type   | Automated Command | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------- | ----------------------------------------------------------------- | ----------- | ----------------- | ----------- | ---------- |
| 1-01-01 | 01   | 1    | AGNT-01     | T-1-01     | Advisor tool surface is read-only only                            | unit        | `node --test`     | ❌ W0       | ⬜ pending |
| 1-01-02 | 01   | 1    | AGNT-02     | T-1-02     | Executor retains exclusive mutation path                          | unit        | `node --test`     | ❌ W0       | ⬜ pending |
| 1-01-03 | 02   | 1    | AGNT-03     | T-1-03     | Repo-scoped assets are written to project-local paths only        | unit        | `node --test`     | ❌ W0       | ⬜ pending |
| 1-01-04 | 02   | 1    | SETP-01     | T-1-04     | Scaffold flow produces expected files without global side effects | integration | `node --test`     | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `test/advisor-role.test.js` — verifies advisor file/tool contract for AGNT-01
- [ ] `test/executor-boundary.test.js` — verifies executor-only mutation contract for AGNT-02
- [ ] `test/scaffold-layout.test.js` — verifies scaffolded asset paths for AGNT-03
- [ ] `test/scaffold-flow.test.js` — verifies scaffold command/file creation for SETP-01

---

## Manual-Only Verifications

| Behavior                                     | Requirement | Why Manual                                                     | Test Instructions                                                                                            |
| -------------------------------------------- | ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Scaffold feels understandable to maintainers | SETP-01     | Human clarity/readability cannot be proven by unit tests alone | Run the scaffold from a clean repo state and confirm the generated files and instructions are easy to follow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
