---
phase: 1
slug: repo-scoped-advisor-foundation
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Node.js built-in test runner                                                                                                                                                                          |
| **Config file**        | none — use native `node --test`                                                                                                                                                                       |
| **Quick run command**  | `node --test .claude/advisor-mode/tests/*.test.js`                                                                                                                                                    |
| **Full suite command** | `node --test .claude/advisor-mode/tests/init.test.js .claude/advisor-mode/tests/advisor-agent.test.js .claude/advisor-mode/tests/boundary.test.js .claude/advisor-mode/tests/scaffold-layout.test.js` |
| **Estimated runtime**  | ~10 seconds                                                                                                                                                                                           |

---

## Sampling Rate

- **After every task commit:** Run `node --test .claude/advisor-mode/tests/*.test.js`
- **After every plan wave:** Run `node --test .claude/advisor-mode/tests/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement               | Threat Ref                | Secure Behavior                                                                                                                                                                            | Test Type   | Automated Command                                                | File Exists | Status |
| ------- | ---- | ---- | ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------- | ----------- | ------ |
| 1-01-01 | 01   | 1    | SETP-01                   | T-1-04                    | Scaffold integration test proves repo-local init flow can generate project assets in a temp root.                                                                                          | integration | `node --test .claude/advisor-mode/tests/init.test.js`            | ✅          | ready  |
| 1-02-01 | 02   | 2    | AGNT-01                   | T-1-01                    | Advisor asset keeps `model: opus` and `tools: Read, Grep, Glob`.                                                                                                                           | unit        | `node --test .claude/advisor-mode/tests/advisor-agent.test.js`   | ✅          | ready  |
| 1-02-02 | 02   | 2    | AGNT-02                   | T-1-02                    | Boundary tests keep mutation authority with the executor and keep mutating tools out of the advisor path.                                                                                  | unit        | `node --test .claude/advisor-mode/tests/boundary.test.js`        | ✅          | ready  |
| 1-03-01 | 03   | 2    | AGNT-03                   | T-1-03                    | Layout test proves versioned assets stay under `.claude/` and runtime placeholders stay under `.advisor/`.                                                                                 | integration | `node --test .claude/advisor-mode/tests/scaffold-layout.test.js` | ✅          | ready  |
| 1-04-01 | 04   | 3    | AGNT-02                   | T-01-13                   | Fresh scaffold output exports `validateAdvisorBoundary` and `main`, so boundary drift is detectable in generated installs.                                                                 | integration | `node --test .claude/advisor-mode/tests/init.test.js`            | ✅          | ready  |
| 1-04-02 | 04   | 3    | AGNT-01, AGNT-02, SETP-01 | T-01-11, T-01-12, T-01-14 | Fresh scaffold output reproduces hardened `advisor-reviewer.md` and `executor-guidance.md` wording, including verdict-first contract and executor-owned Bash/Write/Edit/MultiEdit wording. | integration | `node --test .claude/advisor-mode/tests/init.test.js`            | ✅          | ready  |

_Status: ready = validation contract is defined and backed by committed test files._

---

## Wave 0 Requirements

- [x] `.claude/advisor-mode/tests/advisor-agent.test.js` — verifies advisor file/tool contract for AGNT-01
- [x] `.claude/advisor-mode/tests/boundary.test.js` — verifies executor-only mutation contract for AGNT-02
- [x] `.claude/advisor-mode/tests/scaffold-layout.test.js` — verifies scaffolded asset paths for AGNT-03
- [x] `.claude/advisor-mode/tests/init.test.js` — verifies scaffold command, file creation, and generated-output regression for SETP-01 and the fresh-install AGNT-02 closure

---

## Manual-Only Verifications

| Behavior                                     | Requirement | Why Manual                                                     | Test Instructions                                                                                            |
| -------------------------------------------- | ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Scaffold feels understandable to maintainers | SETP-01     | Human clarity/readability cannot be proven by unit tests alone | Run the scaffold from a clean repo state and confirm the generated files and instructions are easy to follow |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or existing Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all required test references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Gap-closure plan `01-04-PLAN.md` is reflected in the validation contract

**Approval:** ready
