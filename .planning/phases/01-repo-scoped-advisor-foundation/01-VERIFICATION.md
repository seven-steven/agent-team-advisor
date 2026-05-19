---
phase: 01-repo-scoped-advisor-foundation
verified: 2026-05-19T16:00:48Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Fresh scaffold output reproduces the hardened advisor/executor boundary assets currently committed under .claude/."
  gaps_remaining:
    - "Advisor boundary drift is surfaced by the wired PreToolUse hook before later enforcement phases build on it."
    - "The scaffold flow is safe to rerun in a repo without silently overwriting customized advisor-mode assets."
  regressions: []
gaps:
  - truth: "Advisor boundary drift is surfaced by the wired PreToolUse hook before later enforcement phases build on it."
    status: failed
    reason: "The boundary validator exists, but the wired PreToolUse entrypoint never calls validateAdvisorBoundary(rootDir). At runtime it only emits reminder context and exits 0, so drift in advisor tools/model is not detected by the installed hook path."
    artifacts:
      - path: ".claude/hooks/advisor-boundary-check.js"
        issue: "main() parses stdin, checks only tool_name, then calls writeHookContext() and exits without invoking validateAdvisorBoundary(rootDir)."
      - path: ".claude/settings.json"
        issue: "PreToolUse is wired to advisor-boundary-check.js, but that wired path is advisory-only and does not validate the advisor asset."
    missing:
      - "Call validateAdvisorBoundary(rootDir) from the runtime hook path used by PreToolUse."
      - "Use CLAUDE_PROJECT_DIR or equivalent project root resolution so the installed hook validates the actual advisor asset."
      - "Surface validation failure clearly instead of always succeeding with reminder-only output."
  - truth: "The scaffold flow is safe to rerun in a repo without silently overwriting customized advisor-mode assets."
    status: failed
    reason: "The scaffold command rewrites existing .claude advisor assets unconditionally. A rerun removes local customizations instead of preserving them or requiring explicit force behavior, which is not safe for evolving the workflow."
    artifacts:
      - path: ".claude/advisor-mode/init.js"
        issue: "writeFile() always uses fs.writeFileSync(target, content) and scaffoldAdvisorMode() rewrites agent, hook, README, schema, and policy files on every run."
    missing:
      - "Preserve existing files by default or require an explicit force flag before overwriting."
      - "Add regression coverage that proves reruns do not silently clobber customized advisor-mode assets."
---

# Phase 1: Repo-Scoped Advisor Foundation Verification Report

**Phase Goal:** As a maintainer, I want to scaffold repo-scoped Advisor Mode assets, so that I can safely evolve the workflow.
**Verified:** 2026-05-19T16:00:48Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure

## User Flow Coverage

| Step                                             | Expected                                                                                                                                  | Evidence in codebase                                                                                                                                                         | Status     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Run one repo-local scaffold flow                 | `node .claude/advisor-mode/init.js` creates repo-scoped advisor assets, settings wiring, policy/schema examples, and runtime placeholders | `.claude/advisor-mode/init.js` exports `main` and `scaffoldAdvisorMode`; temp-root smoke test produced the expected files; `init.test.js` passes                             | ✓ VERIFIED |
| Inspect documented setup flow                    | Maintainer can read install and validation commands from committed assets                                                                 | `.claude/advisor-mode/README.md` documents `node .claude/advisor-mode/init.js` and `node --test .claude/advisor-mode/tests/*.test.js`; `scaffold-layout.test.js` passes      | ✓ VERIFIED |
| Get a structurally read-only advisor asset       | Advisor uses stronger alias and read-only tools only                                                                                      | Checked-in and scaffold-generated `.claude/agents/advisor-reviewer.md` contain `model: opus` and `tools: Read, Grep, Glob`; `advisor-agent.test.js` passes                   | ✓ VERIFIED |
| Safely evolve the workflow from installed assets | Installed boundary hook should actually surface advisor-boundary drift before later phases rely on it                                     | `.claude/hooks/advisor-boundary-check.js` exports `validateAdvisorBoundary`, but its wired `main()` path never calls it; runtime check returns reminder JSON and exit 0 only | ✗ FAILED   |
| Safely rerun scaffold in an existing repo        | Rerunning scaffold should not silently destroy customized advisor assets                                                                  | `.claude/advisor-mode/init.js` writes files unconditionally; rerun smoke check removed an appended customization from generated `advisor-reviewer.md`                        | ✗ FAILED   |

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                            | Status     | Evidence                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Project maintainer can scaffold advisor agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow. | ✓ VERIFIED | `init.js` writes agents, hooks, settings, policy/schema, `.advisor/audit/.gitkeep`, and `.advisor/state/.gitkeep`; README documents the flow; scaffold smoke test passed.                          |
| 2   | Project maintainer can define an advisor agent that uses a stronger model alias and exposes only read-only review tools.                         | ✓ VERIFIED | `.claude/agents/advisor-reviewer.md` and scaffold output both use `model: opus` and `tools: Read, Grep, Glob`; `advisor-agent.test.js` passed.                                                     |
| 3   | User can run an executor-led workflow where workspace mutation and implementation tools remain available only to the executor.                   | ✗ FAILED   | The checked-in advisor asset is read-only, but the installed PreToolUse boundary hook never validates drift at runtime. If advisor frontmatter is widened later, the wired path does not catch it. |
| 4   | Project maintainer can commit and version advisor-mode behavior as project-scoped Claude Code assets inside the repository.                      | ✓ VERIFIED | Versioned assets exist under `.claude/agents/`, `.claude/hooks/`, and `.claude/advisor-mode/`; runtime placeholders remain under `.advisor/`; layout test passed.                                  |
| 5   | Maintainer can safely evolve the workflow by rerunning scaffold without silent configuration loss.                                               | ✗ FAILED   | `init.js` rewrites existing advisor assets on rerun; smoke check showed a local appended marker was removed after the second scaffold run.                                                         |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact                                             | Expected                                      | Status     | Details                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `.claude/advisor-mode/init.js`                       | Repo-local scaffold/init flow                 | ⚠️ PARTIAL | Exists, substantive, and produces correct baseline assets, but rewrites existing files unconditionally. |
| `.claude/advisor-mode/tests/init.test.js`            | End-to-end scaffold regression                | ✓ VERIFIED | Covers generated scaffold output including boundary exports and wording.                                |
| `.claude/advisor-mode/tests/advisor-agent.test.js`   | Advisor frontmatter validation                | ✓ VERIFIED | Validates name, model alias, tool allowlist, and verdict-first contract.                                |
| `.claude/advisor-mode/tests/boundary.test.js`        | Executor/advisor mutation-boundary validation | ✓ VERIFIED | Validates executor wording and invalid advisor tool detection through exported validator.               |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | Repo-scoped layout validation                 | ✓ VERIFIED | Validates documented setup commands, asset placement, and runtime separation.                           |
| `.claude/agents/advisor-reviewer.md`                 | Read-only advisor subagent                    | ✓ VERIFIED | Correct alias and read-only tool set are present.                                                       |
| `.claude/agents/executor-guidance.md`                | Executor-only mutation guidance               | ✓ VERIFIED | Explicitly names Bash, Write, Edit, and MultiEdit as executor-owned mutation tools.                     |
| `.claude/hooks/advisor-boundary-check.js`            | Boundary validator and wired hook entrypoint  | ⚠️ PARTIAL | Exports `validateAdvisorBoundary` and `main`, but the wired `main()` path does not use the validator.   |
| `.claude/hooks/advisor-install-audit.js`             | Non-blocking install audit hook               | ✓ VERIFIED | Exists and matches current Phase 1 warning-only behavior.                                               |
| `.claude/settings.json`                              | Claude Code hook wiring                       | ✓ VERIFIED | Preserves existing GSD hooks and wires advisor hooks once.                                              |
| `.claude/advisor-mode/README.md`                     | Documented setup flow                         | ✓ VERIFIED | Documents install and validation commands and Phase 1 scope limits.                                     |
| `.claude/advisor-mode/policy.example.json`           | Versioned policy example                      | ✓ VERIFIED | Contains `.advisor/audit/events.jsonl` target and baseline event names.                                 |
| `.claude/advisor-mode/verdict.schema.json`           | Versioned verdict schema example              | ✓ VERIFIED | Requires Phase 1 verdict fields.                                                                        |

### Key Link Verification

| From                                                 | To                                         | Via                           | Status     | Details                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------ | ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ----------- |
| `.claude/advisor-mode/README.md`                     | `.claude/advisor-mode/init.js`             | documented command            | ✓ WIRED    | README contains the exact scaffold command.                                                                          |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | `.claude/advisor-mode/policy.example.json` | versioned asset assertion     | ✓ WIRED    | Test parses the generated policy example and checks baseline events.                                                 |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | `.advisor/audit`                           | runtime separation assertion  | ✓ WIRED    | Test checks runtime directories are under `.advisor/`, not `.planning/`.                                             |
| `.claude/hooks/advisor-boundary-check.js`            | `.claude/agents/advisor-reviewer.md`       | frontmatter scan              | ⚠️ PARTIAL | `validateAdvisorBoundary(rootDir)` reads the advisor asset, but the installed hook path never invokes that function. |
| `.claude/advisor-mode/tests/boundary.test.js`        | `.claude/agents/executor-guidance.md`      | executor authority assertions | ✓ WIRED    | Test checks explicit executor-only wording and named tool ownership.                                                 |
| `.claude/advisor-mode/init.js`                       | `.claude/settings.json`                    | idempotent settings merge     | ✓ WIRED    | Settings merge preserves existing hook entries and adds advisor hooks once.                                          |
| `.claude/settings.json`                              | `.claude/hooks/advisor-boundary-check.js`  | PreToolUse command hook       | ✓ WIRED    | Hook command is registered for `Bash                                                                                 | Edit | Write | MultiEdit`. |
| `.claude/advisor-mode/init.js`                       | `.advisor/audit/.gitkeep`                  | runtime directory creation    | ✓ WIRED    | Runtime placeholder files are created during scaffold.                                                               |

### Data-Flow Trace (Level 4)

| Artifact                                  | Data Variable                             | Source                                                           | Produces Real Data                                                       | Status                  |
| ----------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| `.claude/advisor-mode/init.js`            | Generated asset content                   | In-memory template map written by `scaffoldAdvisorMode(rootDir)` | Yes                                                                      | ✓ FLOWING               |
| `.claude/hooks/advisor-boundary-check.js` | `frontmatter`, `advisorTools`, `findings` | Reads `.claude/agents/advisor-reviewer.md` from provided root    | Yes, but only when `validateAdvisorBoundary(rootDir)` is called directly | ⚠️ HOLLOW IN WIRED PATH |

### Behavioral Spot-Checks

| Behavior                                                     | Command                                                                                                                                                                                               | Result                                                                                              | Status                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- | ------ |
| Phase 1 Node tests pass                                      | `node --test .claude/advisor-mode/tests/init.test.js .claude/advisor-mode/tests/advisor-agent.test.js .claude/advisor-mode/tests/boundary.test.js .claude/advisor-mode/tests/scaffold-layout.test.js` | `pass 6, fail 0`                                                                                    | ✓ PASS                       |
| Fresh scaffold reproduces hardened generated boundary assets | Temp-root scaffold smoke test                                                                                                                                                                         | `{"hasValidate":true,"hasMain":true,"boundaryOk":true,"guidanceHasAll":true,"advisorVerdict":true}` | ✓ PASS                       |
| Wired boundary hook validates at runtime                     | `printf '{"tool_name":"Write"}'                                                                                                                                                                       | node .claude/hooks/advisor-boundary-check.js`                                                       | Reminder JSON only, `EXIT:0` | ✗ FAIL |
| Exported validator rejects invalid advisor tools             | Temp-root invalid advisor asset + `validateAdvisorBoundary(root)`                                                                                                                                     | `ok:false` with findings mentioning `Write`                                                         | ✓ PASS                       |
| Scaffold rerun preserves existing customizations             | Temp-root rerun smoke check with appended marker                                                                                                                                                      | Appended marker removed after rerun; last line reverted to generated template content               | ✗ FAIL                       |

### Probe Execution

| Probe                       | Command | Result                                                         | Status |
| --------------------------- | ------- | -------------------------------------------------------------- | ------ |
| None declared or discovered | n/a     | No `probe-*.sh` paths found in plans, summaries, or `scripts/` | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                                                          | Status      | Evidence                                                                                                                                                                                |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGNT-01     | 01-01, 01-02, 01-04 | Project maintainer can define an advisor agent that uses a stronger model alias and only read-only review tools                                      | ✓ SATISFIED | Advisor asset and generated scaffold output both use `model: opus` and `tools: Read, Grep, Glob`; tests pass.                                                                           |
| AGNT-02     | 01-01, 01-02, 01-04 | User can run an executor-led workflow where only the executor is allowed to mutate the workspace and run implementation tools                        | ✗ BLOCKED   | Executor wording exists, but the installed PreToolUse boundary hook never validates advisor drift at runtime, so the boundary is not actually surfaced/enforced through the wired path. |
| AGNT-03     | 01-01, 01-03, 01-04 | Project maintainer can version advisor-mode behavior as project-scoped Claude Code assets inside the repository                                      | ✓ SATISFIED | Versioned assets are committed under `.claude/`; runtime placeholders are separated under `.advisor/`.                                                                                  |
| SETP-01     | 01-01, 01-03, 01-04 | Project maintainer can scaffold advisor-mode agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow | ✓ SATISFIED | Documented setup flow exists and scaffold command produces the expected asset set. Note: rerun safety remains a separate blocker against the phase goal outcome.                        |

No orphaned Phase 1 requirements found in `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File                                      | Line                          | Pattern                                                 | Severity | Impact                                                                        |
| ----------------------------------------- | ----------------------------- | ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `.claude/hooks/advisor-boundary-check.js` | wired `main()` path           | Validator exported but unused in installed runtime path | BLOCKER  | Boundary drift is not surfaced by the actual hook entrypoint.                 |
| `.claude/advisor-mode/init.js`            | `writeFile()` / scaffold loop | Unconditional overwrite of existing scaffold assets     | BLOCKER  | Rerunning scaffold can silently destroy customized repo-local configuration.  |
| `.claude/advisor-mode/init.js`            | `RUNTIME_PLACEHOLDERS` symbol | Placeholder token match from scan only                  | INFO     | Not a stub; this is a constant name, not an incomplete implementation marker. |

### Human Verification Required

None. The remaining blockers are directly observable from code and command results.

### Gaps Summary

The previous scaffold-template drift gap is closed: a fresh scaffold now reproduces the hardened advisor asset, executor guidance, and generated boundary hook exports.

Phase 1 still does not achieve its goal, because two safety-critical properties are missing in the actual code path maintainers will rely on:

1. The installed PreToolUse boundary hook is wired, but its `main()` path never calls `validateAdvisorBoundary(rootDir)`. Runtime behavior is reminder-only, so advisor drift is not surfaced before later phases build on this foundation.
2. The scaffold command is destructive on rerun. It rewrites existing `.claude` assets without prompting or a force flag, so maintainers cannot safely evolve customized repo-scoped assets by rerunning the documented setup flow.

These are blocker-level gaps because the phase goal is not just to create files, but to provide a scaffold foundation that is safe to evolve.

---

_Verified: 2026-05-19T16:00:48Z_
_Verifier: Claude (gsd-verifier)_
