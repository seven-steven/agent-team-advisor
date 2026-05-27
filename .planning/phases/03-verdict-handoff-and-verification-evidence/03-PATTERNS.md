# Phase 3: Verdict Handoff and Verification Evidence - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 14
**Analogs found:** 14 / 14

## File Classification

| New/Modified File                                          | Role       | Data Flow                                  | Closest Analog                                       | Match Quality |
| ---------------------------------------------------------- | ---------- | ------------------------------------------ | ---------------------------------------------------- | ------------- |
| `.claude/advisor-mode/final-review.js`                     | utility    | request-response + file-I/O + transform    | `.claude/advisor-mode/init.js`                       | role-match    |
| `.claude/hooks/advisor-final-review-gate.js`               | middleware | event-driven + request-response + file-I/O | `.claude/hooks/advisor-boundary-check.js`            | role-match    |
| `.claude/settings.json`                                    | config     | event-driven                               | `.claude/settings.json`                              | exact         |
| `.claude/advisor-mode/verdict.schema.json`                 | config     | transform                                  | `.claude/advisor-mode/verdict.schema.json`           | exact         |
| `.claude/advisor-mode/context-packet.schema.json`          | config     | transform                                  | `.claude/advisor-mode/verdict.schema.json`           | role-match    |
| `.claude/advisor-mode/disposition.schema.json`             | config     | transform                                  | `.claude/advisor-mode/verdict.schema.json`           | role-match    |
| `.claude/advisor-mode/verification-evidence.schema.json`   | config     | transform                                  | `.claude/advisor-mode/verdict.schema.json`           | role-match    |
| `.claude/agents/advisor-reviewer.md`                       | provider   | request-response                           | `.claude/agents/advisor-reviewer.md`                 | exact         |
| `.claude/advisor-mode/README.md`                           | config     | request-response                           | `.claude/advisor-mode/README.md`                     | exact         |
| `.claude/advisor-mode/tests/final-review-gate.test.js`     | test       | event-driven + file-I/O                    | `.claude/advisor-mode/tests/boundary.test.js`        | role-match    |
| `.claude/advisor-mode/tests/verdict-handoff.test.js`       | test       | transform                                  | `.claude/advisor-mode/tests/advisor-agent.test.js`   | role-match    |
| `.claude/advisor-mode/tests/disposition.test.js`           | test       | transform + file-I/O                       | `.claude/advisor-mode/tests/init.test.js`            | role-match    |
| `.claude/advisor-mode/tests/verification-evidence.test.js` | test       | file-I/O + transform                       | `.claude/advisor-mode/tests/scaffold-layout.test.js` | role-match    |
| `.claude/advisor-mode/tests/context-packet.test.js`        | test       | transform                                  | `.claude/advisor-mode/tests/advisor-agent.test.js`   | role-match    |

## Pattern Assignments

### `.claude/advisor-mode/final-review.js` (utility, request-response + file-I/O + transform)

**Analog:** `.claude/advisor-mode/init.js`

**Imports and constants pattern** (lines 0-12):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const BOUNDARY_COMMAND =
  '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-boundary-check.js';
const AUDIT_COMMAND =
  '"/usr/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-install-audit.js';
const GITIGNORE_RULES = [
  ".advisor/audit/*.jsonl",
  "!.advisor/audit/.gitkeep",
  ".advisor/state/*.json",
  "!.advisor/state/.gitkeep",
];
const RUNTIME_PLACEHOLDERS = [
  ".advisor/audit/.gitkeep",
  ".advisor/state/.gitkeep",
];
```

**File I/O helpers pattern** (lines 300-315):

```javascript
function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(rootDir, relativePath, content) {
  const target = path.join(rootDir, relativePath);
  ensureDir(target);
  fs.writeFileSync(target, content);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
```

**CLI/main/export pattern** (lines 385-408):

```javascript
function main(argv = process.argv.slice(2)) {
  let rootDir = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") {
      if (!argv[index + 1]) {
        throw new Error("--root requires a path");
      }
      rootDir = argv[index + 1];
      index += 1;
    }
  }
  scaffoldAdvisorMode(rootDir);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, scaffoldAdvisorMode };
```

**Planner adaptation:** Export pure functions such as `buildContextPacket`, `validateVerdict`, `recordExecutorDecision`, `recordVerificationEvidence`, and `isFinalReviewFresh` so tests can require them directly. Use `.advisor/audit/events.jsonl` and `.advisor/state/final-review.json` runtime paths, not `.planning/`.

---

### `.claude/hooks/advisor-final-review-gate.js` (middleware, event-driven + request-response + file-I/O)

**Analog:** `.claude/hooks/advisor-boundary-check.js`

**Hook imports and constants pattern** (lines 0-6):

```javascript
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_MODEL = "opus";
const REQUIRED_TOOLS = ["Read", "Grep", "Glob"];
const MUTATING_TOOLS = ["Bash", "Write", "Edit", "MultiEdit"];
```

**Validation return shape pattern** (lines 42-80):

```javascript
function validateAdvisorBoundary(rootDir) {
  const findings = [];
  let frontmatter = {};

  try {
    const advisorPath = path.join(
      rootDir,
      ".claude",
      "agents",
      "advisor-reviewer.md",
    );
    frontmatter = parseFrontmatter(fs.readFileSync(advisorPath, "utf8"));
  } catch (error) {
    findings.push(`advisor-reviewer.md unreadable: ${error.message}`);
  }

  return {
    ok: findings.length === 0,
    findings,
    advisorTools,
  };
}
```

**Structured hook response pattern** (lines 82-91):

```javascript
function writeHookContext() {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext:
        "Advisor Mode boundary check: advisor remains read-only; executor retains mutation and command authority.",
    },
  };
  process.stdout.write(JSON.stringify(output));
}
```

**Hook stdin and fail-open pattern** (lines 93-124):

```javascript
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
      if (!toolName) {
        process.exit(0);
      }

      writeHookContext();
    } catch {
      process.exit(0);
    }
  });
}
```

**Planner adaptation:** Use this hook skeleton for completion-time gating. For a blocking final-review gate, keep parsing/fail-open for malformed hook input, but when explicit workflow state says non-trivial completion lacks a fresh final verdict, emit a structured Claude Code hook block/decision message consistent with local hook semantics. Preserve advisor read-only boundary.

---

### `.claude/settings.json` (config, event-driven)

**Analog:** `.claude/settings.json`

**Existing hook grouping pattern** (lines 1-27):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/gsd-check-update.js"
          }
        ]
      }
    ]
  }
}
```

**PostToolUse hook entry pattern** (lines 59-68):

```json
{
  "matcher": "Bash|Edit|Write|MultiEdit|Agent|Task",
  "hooks": [
    {
      "type": "command",
      "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/advisor-install-audit.js",
      "timeout": 5
    }
  ]
}
```

**PreToolUse hook entry pattern** (lines 111-120):

```json
{
  "matcher": "Bash|Edit|Write|MultiEdit",
  "hooks": [
    {
      "type": "command",
      "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/advisor-boundary-check.js",
      "timeout": 5
    }
  ]
}
```

**Planner adaptation:** Add final-review hook wiring idempotently. Preserve all existing `gsd-*` and `advisor-*` entries. Prefer adding a `Stop` hook if Claude Code completion lifecycle is available; otherwise add a local finalize command/fallback documented in README.

---

### `.claude/advisor-mode/verdict.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Schema header and strict object pattern** (lines 0-12):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Advisor Mode Verdict",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "status",
    "risk",
    "confidence",
    "blocking_findings",
    "recommended_actions",
    "verification_guidance"
  ]
}
```

**Enum and array field pattern** (lines 14-57):

```json
"status": {
  "type": "string",
  "enum": [
    "PASS",
    "CONCERNS",
    "FAIL",
    "BLOCKED"
  ]
},
"blocking_findings": {
  "type": "array",
  "items": {
    "type": "string"
  }
}
```

**Planner adaptation:** Extend rather than replace. Add final-review correlation/freshness fields only as needed. Keep `PASS`, `CONCERNS`, `FAIL`, `BLOCKED` semantics: only `PASS` allows direct completion; other statuses require executor decision artifact.

---

### `.claude/advisor-mode/context-packet.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Copy schema-first strict JSON pattern** from verdict schema lines 0-12. Required fields should mirror Phase 3 locked decisions: changed files, relevant diff excerpts, relevant errors, explicit questions. Include concise verification summary if useful; exclude raw transcript/full logs by default via `additionalProperties: false` and explicit field whitelist.

---

### `.claude/advisor-mode/disposition.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Copy enum/array field pattern** from verdict schema lines 14-57. Required fields should include per-recommendation entries with recommendation identifier, `accepted` / `rejected` / `deferred`, rationale, evidence references, and timestamp. Keep a separate artifact; do not mutate advisor verdict artifacts.

---

### `.claude/advisor-mode/verification-evidence.schema.json` (config, transform)

**Analog:** `.claude/advisor-mode/verdict.schema.json`

**Copy strict object pattern** from verdict schema lines 0-12. Required fields should include command-level evidence (`command`, `exit_status`, result summary, timestamp) plus package-level changed files and residual risks. Treat the artifact as immutable per guarded task/review round.

---

### `.claude/agents/advisor-reviewer.md` (provider, request-response)

**Analog:** `.claude/agents/advisor-reviewer.md`

**Read-only advisor frontmatter pattern** (lines 0-6):

```markdown
---
name: advisor-reviewer
description: Read-only Advisor Mode reviewer for risk, findings, actions, and verification guidance.
model: opus
tools: Read, Grep, Glob
color: "#7C3AED"
---
```

**Boundary pattern** (lines 8-14):

```markdown
<role>
You are the Advisor Mode reviewer. Inspect repository context and return a verdict-first review for the executor.
</role>

<boundaries>
You are read-only. The executor retains all workspace mutation, command execution, commit, and final decision authority.
</boundaries>
```

**Output contract pattern** (lines 16-23):

```markdown
<output>
Return a verdict-first response with:
1. status: PASS, CONCERNS, FAIL, or BLOCKED
2. risk level and confidence
3. blocking findings
4. recommended executor actions
5. verification guidance
</output>
```

**Planner adaptation:** Extend output instructions to require answering executor explicit questions from the minimized context packet and to request additional context explicitly when the packet is insufficient. Do not add mutating tools.

---

### `.claude/advisor-mode/README.md` (config, request-response)

**Analog:** `.claude/advisor-mode/README.md`

**Install and test command documentation pattern** (lines 0-12):

````markdown
# Advisor Mode Scaffold

Advisor Mode is installed as repo-scoped Claude Code assets. Run this from the repository root:

```bash
node .claude/advisor-mode/init.js
```
````

Validate Phase 1 local install correctness with:

```bash
node --test .claude/advisor-mode/tests/*.test.js
```

````

**Created files list pattern** (lines 14-24):

```markdown
## Created Files

- `.claude/agents/advisor-reviewer.md` — read-only advisor role definition.
- `.claude/agents/executor-guidance.md` — executor authority guidance.
- `.claude/hooks/advisor-boundary-check.js` — boundary reminder hook.
- `.claude/hooks/advisor-install-audit.js` — scaffold audit reminder hook.
- `.claude/settings.json` — project-local hook wiring.
- `.claude/advisor-mode/policy.example.json` — versioned policy example.
- `.claude/advisor-mode/verdict.schema.json` — versioned advisor verdict schema.
- `.advisor/audit` — local runtime audit directory for JSONL events.
- `.advisor/state` — local runtime state directory.
````

**Boundary documentation pattern** (lines 26-28):

```markdown
## Phase 1 Boundary

Phase 1 validates local scaffold installation only. Provider routing conformance, high-risk trigger enforcement, budgets, and full telemetry are later phases.
```

**Planner adaptation:** Add Phase 3 final-review artifact conventions and verification commands without documenting Phase 4/5 provider routing, budgets, rollback, or audit dashboard work.

---

### `.claude/advisor-mode/tests/final-review-gate.test.js` (test, event-driven + file-I/O)

**Analog:** `.claude/advisor-mode/tests/boundary.test.js`

**Test imports and requiring hook under test** (lines 0-10):

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const claudeRoot = path.resolve(__dirname, "..", "..");
const executorPath = path.join(claudeRoot, "agents", "executor-guidance.md");
const boundaryHookPath = path.join(
  claudeRoot,
  "hooks",
  "advisor-boundary-check.js",
);
const { validateAdvisorBoundary } = require(boundaryHookPath);
```

**Temp fixture pattern** (lines 11-20):

```javascript
function makeTempAdvisor(toolsLine) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "advisor-boundary-"));
  const agentsDir = path.join(root, ".claude", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(agentsDir, "advisor-reviewer.md"),
    `---\nname: advisor-reviewer\nmodel: opus\ntools: ${toolsLine}\n---\n\nRead-only advisor.\n`,
  );
  return root;
}
```

**Assertion style pattern** (lines 36-45):

```javascript
test("validateAdvisorBoundary reports mutating advisor tools", () => {
  assert.equal(typeof validateAdvisorBoundary, "function");
  const root = makeTempAdvisor("Read, Grep, Glob, Write");

  const result = validateAdvisorBoundary(root);

  assert.equal(result.ok, false);
  assert.deepEqual(result.advisorTools, ["Read", "Grep", "Glob", "Write"]);
  assert.equal(
    result.findings.some((finding) => finding.includes("Write")),
    true,
  );
});
```

---

### `.claude/advisor-mode/tests/verdict-handoff.test.js` (test, transform)

**Analog:** `.claude/advisor-mode/tests/advisor-agent.test.js`

**Frontmatter/parser helper pattern** (lines 8-23):

```javascript
function readFrontmatter(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `${filePath} should start with frontmatter`);

  return Object.fromEntries(
    match[1]
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        assert.notEqual(
          separator,
          -1,
          `frontmatter line should be key/value: ${line}`,
        );
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim(),
        ];
      }),
  );
}
```

**Contract assertion style** (lines 37-48):

```javascript
test("advisor reviewer response contract is verdict-first and advisory", () => {
  const source = fs.readFileSync(advisorPath, "utf8");

  assert.match(source, /verdict-first/i);
  assert.match(source, /status: PASS, CONCERNS, FAIL, or BLOCKED/);
  assert.match(source, /risk level and confidence/i);
  assert.match(source, /blocking findings/i);
  assert.match(source, /recommended executor actions/i);
  assert.match(source, /verification guidance/i);
  assert.match(source, /read-only/i);
  assert.match(source, /executor retains all workspace mutation/i);
});
```

---

### `.claude/advisor-mode/tests/disposition.test.js` (test, transform + file-I/O)

**Analog:** `.claude/advisor-mode/tests/init.test.js`

**Temp repo and command execution pattern** (lines 10-44):

```javascript
function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "advisor-mode-init-"));
  fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".claude", "settings.json"),
    JSON.stringify({ hooks: { PostToolUse: [] } }, null, 2) + "\n",
  );
  return root;
}

function runInit(root) {
  execFileSync(process.execPath, [initScript, "--root", root], {
    cwd: root,
    stdio: "pipe",
  });
}
```

**Read helper and idempotent assertion pattern** (lines 46-54, 56-61):

```javascript
function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function settingsCommands(settings, eventName) {
  return (settings.hooks[eventName] || []).flatMap((entry) =>
    (entry.hooks || []).map((hook) => hook.command),
  );
}

test('scaffold creates advisor-mode assets and preserves settings idempotently', () => {
  const root = makeTempRepo();

  runInit(root);
  runInit(root);
```

**Planner adaptation:** Test disposition record creation per advisor recommendation. Assert accepted/rejected/deferred enum values, rationale, evidence references, timestamp, and append-only audit event. Do not test advisor mutation.

---

### `.claude/advisor-mode/tests/verification-evidence.test.js` (test, file-I/O + transform)

**Analog:** `.claude/advisor-mode/tests/scaffold-layout.test.js`

**Versioned asset/runtime separation pattern** (lines 7-18):

```javascript
const initScript = path.resolve(__dirname, "..", "init.js");
const versionedAssets = [
  ".claude/agents/advisor-reviewer.md",
  ".claude/agents/executor-guidance.md",
  ".claude/hooks/advisor-boundary-check.js",
  ".claude/hooks/advisor-install-audit.js",
  ".claude/settings.json",
  ".claude/advisor-mode/README.md",
  ".claude/advisor-mode/policy.example.json",
  ".claude/advisor-mode/verdict.schema.json",
];
const runtimeDirectories = [".advisor/audit", ".advisor/state"];
```

**Runtime path assertion pattern** (lines 51-55):

```javascript
assertExists(root, ".advisor/audit/.gitkeep");
assertExists(root, ".advisor/state/.gitkeep");
assert.equal(
  fs.existsSync(path.join(root, ".planning", "advisor-audit.jsonl")),
  false,
);
assert.equal(
  fs.existsSync(path.join(root, ".planning", "advisor-state.json")),
  false,
);
```

**Policy/audit event assertion pattern** (lines 64-70):

```javascript
const policy = JSON.parse(
  read(root, ".claude/advisor-mode/policy.example.json"),
);
assert.equal(
  policy.advisorMode.runtime.auditTarget,
  ".advisor/audit/events.jsonl",
);
assert.deepEqual(policy.advisorMode.auditEvents.baseline, [
  "scaffold.install",
  "advisor.verdict.received",
  "executor.followup.recorded",
]);
```

**Planner adaptation:** Test evidence artifacts under `.advisor/`, not `.planning/`. Assert command entries include command, exit status, concise summary, timestamp, changed files, and residual risks.

---

### `.claude/advisor-mode/tests/context-packet.test.js` (test, transform)

**Analog:** `.claude/advisor-mode/tests/advisor-agent.test.js`

**Contract assertion pattern:** copy `assert.match` contract style from `advisor-agent.test.js` lines 37-48. Test minimized packet whitelist: changed files, relevant diff excerpts, relevant errors, explicit questions, concise verification summary. Add negative assertions that raw transcript/full logs are absent by default.

## Shared Patterns

### CommonJS runtime

**Source:** `.claude/package.json` lines 0-0
**Apply to:** All `.claude/hooks/*.js`, `.claude/advisor-mode/*.js`, and `.claude/advisor-mode/tests/*.test.js`

```json
{ "type": "commonjs" }
```

### Hook stdin parsing and fail-open behavior

**Source:** `.claude/hooks/advisor-boundary-check.js` lines 93-113
**Apply to:** `.claude/hooks/advisor-final-review-gate.js`

```javascript
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
    // hook logic
  } catch {
    process.exit(0);
  }
});
```

### Structured hook output envelope

**Source:** `.claude/hooks/advisor-install-audit.js` lines 14-20
**Apply to:** All advisor hook messages and final-review gate outputs

```javascript
const output = {
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext:
      "Advisor Mode install audit hook active; Phase 1 records no runtime events by default.",
  },
};
process.stdout.write(JSON.stringify(output));
```

### Runtime artifact separation

**Source:** `.claude/advisor-mode/policy.example.json` lines 6-16
**Apply to:** executor-decision artifacts, verification-evidence artifacts, final-review freshness state, audit events

```json
"runtime": {
  "auditPattern": ".advisor/audit/*.jsonl",
  "auditTarget": ".advisor/audit/events.jsonl",
  "statePattern": ".advisor/state/*.json"
},
"auditEvents": {
  "baseline": [
    "scaffold.install",
    "advisor.verdict.received",
    "executor.followup.recorded"
  ]
}
```

### Advisor read-only boundary

**Source:** `.claude/agents/advisor-reviewer.md` lines 0-14
**Apply to:** advisor prompt changes, final-review workflow, tests

```markdown
model: opus
tools: Read, Grep, Glob

<boundaries>
You are read-only. The executor retains all workspace mutation, command execution, commit, and final decision authority.
</boundaries>
```

### Node built-in tests

**Source:** `.claude/advisor-mode/tests/boundary.test.js` lines 0-4
**Apply to:** All Phase 3 tests

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
```

## No Analog Found

All planned Phase 3 files have at least a role-match analog in the current codebase. Note that `.claude/hooks/advisor-gate.js` and `.claude/hooks/advisor-failure-tracker.js` are referenced by Phase 3 context as established seams, but they were not present in this worktree. Use current available advisor hook patterns above unless those Phase 2 files are available in the execution workspace.

## Metadata

**Analog search scope:** `.claude/advisor-mode/`, `.claude/hooks/`, `.claude/agents/`, `.claude/settings.json`, `.claude/package.json`, `.advisor/`
**Files scanned:** 20+ advisor/Claude asset files plus Phase 1/2 planning artifacts
**Project skills:** none found under `.claude/skills/` or `.agents/skills/`
**Pattern extraction date:** 2026-05-27
