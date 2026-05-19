---
phase: 01-repo-scoped-advisor-foundation
reviewed: 2026-05-19T12:05:07Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - .advisor/audit/.gitkeep
  - .advisor/state/.gitkeep
  - .claude/advisor-mode/README.md
  - .claude/advisor-mode/init.js
  - .claude/advisor-mode/policy.example.json
  - .claude/advisor-mode/tests/advisor-agent.test.js
  - .claude/advisor-mode/tests/boundary.test.js
  - .claude/advisor-mode/tests/init.test.js
  - .claude/advisor-mode/tests/scaffold-layout.test.js
  - .claude/advisor-mode/verdict.schema.json
  - .claude/agents/advisor-reviewer.md
  - .claude/agents/executor-guidance.md
  - .claude/hooks/advisor-boundary-check.js
  - .claude/hooks/advisor-install-audit.js
  - .claude/settings.json
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-19T12:05:07Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the repo-scoped Advisor Mode scaffold, generated assets, runtime hooks, and the tests that exercise them. The main problems are not cosmetic: the installer can overwrite the checked-in assets with stale embedded templates, and the boundary hook never actually enforces the read-only advisor contract it claims to protect.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Installer overwrites checked-in assets with stale templates and breaks the tested contract

**File:** `.claude/advisor-mode/init.js:41-55,56-85,277-285`
**Issue:** `init.js` hardcodes scaffold content for `.claude/agents/executor-guidance.md` and `.claude/hooks/advisor-boundary-check.js`, then rewrites those files unconditionally on every run. Those embedded templates do not match the checked-in source files the repo currently tests:

- the scaffolded `executor-guidance.md` text omits the explicit `Bash`, `Write`, `Edit`, and `MultiEdit` tool list required by `.claude/advisor-mode/tests/boundary.test.js:23-35`
- the scaffolded `advisor-boundary-check.js` omits `validateAdvisorBoundary` and `module.exports`, which `.claude/advisor-mode/tests/boundary.test.js:9-10,37-46` imports and exercises

Running the installer in this repository therefore downgrades the existing files to older content and can make the current test suite fail. Because the writes are unconditional, this also destroys any repo-local edits to those versioned assets.

**Fix:** Make the scaffold use a single source of truth instead of duplicated inline templates, and stop blindly overwriting existing versioned assets.

```js
function copyTemplate(rootDir, relativePath) {
  const sourcePath = path.join(__dirname, "..", relativePath);
  const targetPath = path.join(rootDir, relativePath);
  ensureDir(targetPath);

  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

for (const relativePath of [
  ".claude/agents/advisor-reviewer.md",
  ".claude/agents/executor-guidance.md",
  ".claude/hooks/advisor-boundary-check.js",
  ".claude/hooks/advisor-install-audit.js",
  ".claude/advisor-mode/README.md",
  ".claude/advisor-mode/policy.example.json",
  ".claude/advisor-mode/verdict.schema.json",
]) {
  copyTemplate(resolvedRoot, relativePath);
}
```

### CR-02: Boundary hook never validates the advisor tool boundary at runtime

**File:** `.claude/hooks/advisor-boundary-check.js:43-80,94-125`
**Issue:** The file defines `validateAdvisorBoundary`, but `main()` never calls it. At runtime the hook only parses stdin, checks that `tool_name` exists, and always emits a reminder before exiting successfully. If `advisor-reviewer.md` is changed to include `Write`, `Edit`, or `Bash`, the hook still allows the session to proceed. That leaves the project’s “advisor must remain read-only” safety boundary unenforced in the only place that could automatically stop violations.

This is a real security gap, not just a missing nicety: the repo documents the advisor as read-only, wires this script into `PreToolUse` in `.claude/settings.json:113-120`, and even tests the validator helper separately, but the live hook path never uses that validator.

**Fix:** Validate the advisor agent file inside `main()` and fail the hook when the toolset or model is invalid.

```js
function main() {
  let input = "";
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    try {
      const data = input ? JSON.parse(input) : {};
      const toolName = data.tool_name || data.toolName || "";
      if (!toolName) process.exit(0);

      const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
      const result = validateAdvisorBoundary(rootDir);
      if (!result.ok) {
        process.stderr.write(`${result.findings.join("\n")}\n`);
        process.exit(2);
      }

      writeHookContext();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exit(2);
    }
  });
}
```

## Warnings

### WR-01: Generated hook commands hard-code `/usr/bin/node` and will fail on non-matching Node installs

**File:** `.claude/advisor-mode/init.js:5-6`
**Issue:** Both generated hook commands pin the interpreter to `/usr/bin/node`. That works only on systems where Node lives at exactly that path. Repos using `nvm`, Homebrew, asdf, container images with a different prefix, or non-Linux environments will scaffold hooks that cannot start.

**Fix:** Generate commands from the current runtime path or rely on PATH resolution.

```js
const NODE = JSON.stringify(process.execPath);
const BOUNDARY_COMMAND = `${NODE} "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-boundary-check.js`;
const AUDIT_COMMAND = `${NODE} "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-install-audit.js`;
```

### WR-02: Audit policy advertises baseline events and a JSONL target, but the implementation never records them

**File:** `.claude/advisor-mode/policy.example.json:7-22`, `.claude/hooks/advisor-install-audit.js:1-25`, `.claude/advisor-mode/init.js:86-111`
**Issue:** The shipped policy declares an audit target at `.advisor/audit/events.jsonl` and baseline events including `scaffold.install`, `advisor.verdict.received`, and `executor.followup.recorded`. The implementation does not append any JSONL records to that file during scaffold or hook execution; `advisor-install-audit.js` only emits `additionalContext`. Consumers following the policy file will believe audit data exists when Phase 1 actually produces none.

Because observability is a stated project constraint, this mismatch makes the scaffold misleading and undermines downstream automation that expects an audit trail.

**Fix:** Either write the documented JSONL events or reduce the documented contract to what the code really does in Phase 1.

```js
const event = {
  event: "scaffold.install",
  ts: new Date().toISOString(),
  rootDir: resolvedRoot,
};
fs.appendFileSync(
  path.join(resolvedRoot, ".advisor", "audit", "events.jsonl"),
  `${JSON.stringify(event)}\n`,
);
```

---

_Reviewed: 2026-05-19T12:05:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
