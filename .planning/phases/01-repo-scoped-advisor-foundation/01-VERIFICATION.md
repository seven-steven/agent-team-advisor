---
phase: 01-repo-scoped-advisor-foundation
verified: 2026-05-19T12:09:49Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User can run an executor-led workflow where workspace mutation and implementation tools remain available only to the executor."
    status: failed
    reason: "The checked-in hardened assets satisfy the boundary, but the scaffold command generates stale copies that drop the Phase 1 hardening. A fresh scaffolded install does not reproduce the exported boundary validator or the explicit executor-only mutation wording verified elsewhere in the repo."
    artifacts:
      - path: ".claude/advisor-mode/init.js"
        issue: "Embedded template for .claude/hooks/advisor-boundary-check.js is the older non-exporting hook placeholder; generated file has no validateAdvisorBoundary export or module.exports."
      - path: ".claude/advisor-mode/init.js"
        issue: "Embedded template for .claude/agents/executor-guidance.md omits explicit Bash, Write, Edit, and MultiEdit ownership wording present in the checked-in hardened asset."
      - path: ".claude/advisor-mode/init.js"
        issue: "Embedded template for .claude/agents/advisor-reviewer.md uses older output contract wording instead of the final 'verdict-first response with' contract in the checked-in asset."
    missing:
      - "Update init.js templates so scaffolded advisor-reviewer.md, executor-guidance.md, and advisor-boundary-check.js match the hardened Phase 1 assets currently committed under .claude/."
      - "Add regression coverage that inspects generated scaffold output for validateAdvisorBoundary export and explicit executor tool ownership wording."
---

# Phase 1: Repo-Scoped Advisor Foundation Verification Report

**Phase Goal:** As a maintainer, I want to scaffold repo-scoped Advisor Mode assets, so that I can safely evolve the workflow.
**Verified:** 2026-05-19T12:09:49Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## User Flow Coverage

| Step                                              | Expected                                                                                                                          | Evidence in codebase                                                                                                                                                                                                                                                                                              | Status     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Run one repo-local scaffold flow                  | `node .claude/advisor-mode/init.js` writes repo-scoped advisor assets, settings, policy/schema examples, and runtime placeholders | `.claude/advisor-mode/init.js` exports `main` and `scaffoldAdvisorMode`; smoke test created assets under `/tmp/tmp.xA5GEM9oYN`; `init.test.js` passes                                                                                                                                                             | ✓ VERIFIED |
| Inspect documented setup flow                     | Maintainer can read the exact install and validation commands from committed assets                                               | `.claude/advisor-mode/README.md` documents `node .claude/advisor-mode/init.js` and `node --test .claude/advisor-mode/tests/*.test.js`; `scaffold-layout.test.js` passes                                                                                                                                           | ✓ VERIFIED |
| Get a read-only advisor definition                | Scaffolded advisor uses stronger alias and read-only tools                                                                        | Checked-in `.claude/agents/advisor-reviewer.md` and generated `/tmp/tmp.xA5GEM9oYN/.claude/agents/advisor-reviewer.md` both contain `model: opus` and `tools: Read, Grep, Glob`                                                                                                                                   | ✓ VERIFIED |
| Safely evolve the workflow from scaffolded assets | Fresh scaffold output should preserve the hardened repo-scoped role-boundary assets needed for safe evolution                     | Fresh scaffold output under `/tmp/tmp.xA5GEM9oYN` generates a stale `advisor-boundary-check.js` with no `validateAdvisorBoundary` export, stale `executor-guidance.md` without explicit `Bash/Write/Edit/MultiEdit` ownership wording, and stale `advisor-reviewer.md` wording; direct behavioral checks exited 1 | ✗ FAILED   |

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Project maintainer can scaffold advisor agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow. | ✓ VERIFIED | `README.md` documents the flow; `init.js` writes agent files, hooks, settings, policy/schema examples, `.advisor/audit/.gitkeep`, and `.advisor/state/.gitkeep`; scaffold smoke test passed.                                                                                                |
| 2   | Project maintainer can define an advisor agent that uses a stronger model alias and exposes only read-only review tools.                         | ✓ VERIFIED | Checked-in and generated `advisor-reviewer.md` both use `model: opus` and `tools: Read, Grep, Glob`; `advisor-agent.test.js` passed.                                                                                                                                                        |
| 3   | User can run an executor-led workflow where workspace mutation and implementation tools remain available only to the executor.                   | ✗ FAILED   | Checked-in `executor-guidance.md` satisfies this, but generated scaffold output does not reproduce the final hardened guidance and generated boundary hook omits the validator export used to detect drift. Fresh scaffolded installs therefore do not fully preserve the Phase 1 boundary. |
| 4   | Project maintainer can commit and version advisor-mode behavior as project-scoped Claude Code assets inside the repository.                      | ✓ VERIFIED | Versioned assets exist under `.claude/agents/`, `.claude/hooks/`, `.claude/advisor-mode/`; runtime placeholders are separated under `.advisor/`; `scaffold-layout.test.js` passed.                                                                                                          |

**Score:** 3/4 truths verified

### Required Artifacts

| Artifact                                                                                                       | Expected                                                 | Status     | Details                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/init.js`                       | Idempotent scaffold/init flow                            | ⚠️ HOLLOW  | Exists, substantive, and runnable, but embeds stale templates for the boundary hook and agent docs. |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/init.test.js`            | End-to-end scaffold regression test                      | ✓ VERIFIED | Passes, but does not assert generated boundary-hook export or generated executor tool wording.      |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/advisor-agent.test.js`   | Advisor frontmatter validation                           | ✓ VERIFIED | Passes against checked-in advisor asset.                                                            |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/boundary.test.js`        | Executor/advisor mutation-boundary validation            | ✓ VERIFIED | Passes against checked-in hardened assets.                                                          |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/tests/scaffold-layout.test.js` | Repo-scoped layout validation                            | ✓ VERIFIED | Passes for layout/doc/audit-event assertions.                                                       |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/agents/advisor-reviewer.md`                 | Read-only advisor subagent                               | ✓ VERIFIED | Checked-in asset is hardened correctly.                                                             |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/agents/executor-guidance.md`                | Executor-only mutation guidance                          | ✓ VERIFIED | Checked-in asset explicitly names Bash, Write, Edit, and MultiEdit.                                 |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/advisor-boundary-check.js`            | Non-blocking boundary drift hook with exported validator | ✓ VERIFIED | Checked-in asset exports `validateAdvisorBoundary` and `main`.                                      |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/settings.json`                              | Claude Code hook wiring                                  | ✓ VERIFIED | Contains preserved GSD hooks plus advisor boundary/install audit hook registrations.                |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/README.md`                     | Documented setup flow                                    | ✓ VERIFIED | Includes exact install and validation commands plus Phase 1 scope limits.                           |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/policy.example.json`           | Versioned policy example                                 | ✓ VERIFIED | Contains runtime `.advisor/audit/events.jsonl` target and baseline event names.                     |
| `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/verdict.schema.json`           | Versioned verdict schema example                         | ✓ VERIFIED | Requires Phase 1 verdict fields.                                                                    |

### Key Link Verification

| From                                                 | To                                         | Via                           | Status  | Details                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------ | ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `.claude/advisor-mode/README.md`                     | `.claude/advisor-mode/init.js`             | documented command            | ✓ WIRED | README contains `node .claude/advisor-mode/init.js`.                                                           |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | `.claude/advisor-mode/policy.example.json` | versioned asset assertion     | ✓ WIRED | Test parses generated policy and asserts audit target/event names.                                             |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | `.advisor/audit`                           | runtime separation assertion  | ✓ WIRED | Test asserts `.advisor/audit/.gitkeep` exists and `.planning` runtime files do not.                            |
| `.claude/hooks/advisor-boundary-check.js`            | `.claude/agents/advisor-reviewer.md`       | frontmatter scan              | ✓ WIRED | `validateAdvisorBoundary(rootDir)` reads `.claude/agents/advisor-reviewer.md` and checks model/tool allowlist. |
| `.claude/advisor-mode/tests/boundary.test.js`        | `.claude/agents/executor-guidance.md`      | executor authority assertions | ✓ WIRED | Test checks explicit executor ownership wording and tool names.                                                |
| `.claude/advisor-mode/init.js`                       | `.claude/settings.json`                    | idempotent settings merge     | ✓ WIRED | `mergeSettings()` preserves existing hooks and adds advisor hook commands once.                                |
| `.claude/settings.json`                              | `.claude/hooks/advisor-boundary-check.js`  | PreToolUse command hook       | ✓ WIRED | Settings include a `PreToolUse` matcher with advisor boundary hook command.                                    |
| `.claude/advisor-mode/init.js`                       | `.advisor/audit/.gitkeep`                  | runtime directory creation    | ✓ WIRED | `RUNTIME_PLACEHOLDERS` are written during scaffold.                                                            |

### Data-Flow Trace (Level 4)

| Artifact                                  | Data Variable                             | Source                                                    | Produces Real Data                       | Status    |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------- | ---------------------------------------- | --------- |
| `.claude/advisor-mode/init.js`            | File/template outputs                     | In-memory `files` object + `RUNTIME_PLACEHOLDERS`         | Yes, but stale for three hardened assets | ⚠️ HOLLOW |
| `.claude/hooks/advisor-boundary-check.js` | `frontmatter`, `advisorTools`, `findings` | Reads `.claude/agents/advisor-reviewer.md` from repo root | Yes                                      | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                                                       | Command                                                                                                                                                                   | Result                                                                               | Status |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ | ------ | ------ |
| MVP user story format is valid                                 | `gsd-sdk query user-story.validate --story "As a maintainer, I want to scaffold repo-scoped Advisor Mode assets, so that I can safely evolve the workflow." --pick valid` | `true`                                                                               | ✓ PASS |
| Phase 1 tests pass                                             | `node --test ...init.test.js ...advisor-agent.test.js ...boundary.test.js ...scaffold-layout.test.js`                                                                     | `pass 6, fail 0`                                                                     | ✓ PASS |
| Scaffold flow writes assets and merges settings idempotently   | temp-root smoke test invoking `node .claude/advisor-mode/init.js --root <tmp>`                                                                                            | assets created; settings preserve `gsd-context-monitor.js`; advisor hooks added once | ✓ PASS |
| Generated boundary hook exports validator                      | `node -e 'const m=require(...); if(typeof m.validateAdvisorBoundary!=="function") process.exit(1)' /tmp/tmp.xA5GEM9oYN/.claude/hooks/advisor-boundary-check.js`           | exit 1                                                                               | ✗ FAIL |
| Generated executor guidance names mutating tool ownership      | `node -e '.../Bash                                                                                                                                                        | Write                                                                                | Edit   | MultiEdit/... ' /tmp/tmp.xA5GEM9oYN/.claude/agents/executor-guidance.md` | exit 1 | ✗ FAIL |
| Generated advisor reviewer uses final verdict contract wording | `node -e '.../verdict-first response with/i...' /tmp/tmp.xA5GEM9oYN/.claude/agents/advisor-reviewer.md`                                                                   | exit 1                                                                               | ✗ FAIL |

### Probe Execution

| Probe                       | Command | Result                                                         | Status |
| --------------------------- | ------- | -------------------------------------------------------------- | ------ |
| None declared or discovered | n/a     | No `probe-*.sh` paths found in plans, summaries, or `scripts/` | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                                                          | Status      | Evidence                                                                                                                                                                             |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AGNT-01     | 01-01, 01-02 | Project maintainer can define an advisor agent that uses a stronger model alias and only read-only review tools                                      | ✓ SATISFIED | Checked-in and generated `advisor-reviewer.md` use `model: opus` and `tools: Read, Grep, Glob`; tests pass.                                                                          |
| AGNT-02     | 01-01, 01-02 | User can run an executor-led workflow where only the executor is allowed to mutate the workspace and run implementation tools                        | ✗ BLOCKED   | Checked-in repo assets are hardened, but scaffold output regresses the boundary hook export and executor guidance wording, so a fresh install does not fully reproduce the boundary. |
| AGNT-03     | 01-01, 01-03 | Project maintainer can version advisor-mode behavior as project-scoped Claude Code assets inside the repository                                      | ✓ SATISFIED | Assets live under `.claude/`; runtime placeholders live under `.advisor/`; layout test passes.                                                                                       |
| SETP-01     | 01-01, 01-03 | Project maintainer can scaffold advisor-mode agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow | ✓ SATISFIED | README documents the flow; scaffold smoke test creates the documented asset set.                                                                                                     |

No orphaned Phase 1 requirements found in `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern                                                                         | Severity | Impact                                             |
| ---- | ---- | ------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| None | n/a  | No blocking debt markers (`TBD`, `FIXME`, `XXX`) found in Phase 1 files scanned | ℹ️ Info  | Anti-pattern scan did not produce blocker markers. |

### Human Verification Required

None. The blocking gap is directly observable in generated scaffold output.

### Gaps Summary

Phase 1 is close, but the goal is not achieved yet because the scaffold command does not reproduce the final hardened repo-scoped assets.

The checked-in files under `.claude/` are stronger than what `init.js` currently generates. That means the repository itself looks correct, while a maintainer using the documented scaffold flow gets older, weaker copies:

- generated `advisor-boundary-check.js` is only a reminder hook and drops the exported `validateAdvisorBoundary(rootDir)` helper added in Plan 01-02,
- generated `executor-guidance.md` drops the explicit `Bash`, `Write`, `Edit`, and `MultiEdit` ownership wording asserted by `boundary.test.js`,
- generated `advisor-reviewer.md` drops the final verdict-contract wording asserted by `advisor-agent.test.js`.

This is a real outcome gap, not a documentation discrepancy. The current tests pass because they mostly verify checked-in hardened files, not the corresponding files produced by a fresh scaffold run.

---

_Verified: 2026-05-19T12:09:49Z_
_Verifier: Claude (gsd-verifier)_
