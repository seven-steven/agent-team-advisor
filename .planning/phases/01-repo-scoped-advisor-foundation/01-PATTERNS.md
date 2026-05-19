# Phase 1: Repo-Scoped Advisor Foundation - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 17
**Analogs found:** 12 / 17

## File Classification

| New/Modified File                                    | Role       | Data Flow                | Closest Analog                         | Match Quality |
| ---------------------------------------------------- | ---------- | ------------------------ | -------------------------------------- | ------------- |
| `.claude/agents/advisor-reviewer.md`                 | provider   | request-response         | `.claude/agents/gsd-code-reviewer.md`  | role-match    |
| `.claude/agents/executor-guidance.md`                | provider   | request-response         | `.claude/agents/gsd-executor.md`       | role-match    |
| `.claude/hooks/advisor-install-audit.js`             | middleware | event-driven + file-I/O  | `.claude/hooks/gsd-context-monitor.js` | exact         |
| `.claude/hooks/advisor-boundary-check.js`            | middleware | event-driven + transform | `.claude/hooks/gsd-workflow-guard.js`  | exact         |
| `.claude/hooks/advisor-phase-audit.sh`               | middleware | event-driven + transform | `.claude/hooks/gsd-phase-boundary.sh`  | exact         |
| `.claude/settings.json`                              | config     | event-driven             | `.claude/settings.json`                | exact         |
| `.claude/package.json`                               | config     | request-response         | `.claude/package.json`                 | exact         |
| `.claude/advisor-mode/README.md`                     | config     | request-response         | `.claude/commands/gsd/new-project.md`  | partial       |
| `.claude/advisor-mode/policy.example.json`           | config     | transform                | `.claude/settings.json`                | partial       |
| `.claude/advisor-mode/verdict.schema.json`           | config     | transform                | `.claude/settings.json`                | partial       |
| `.claude/advisor-mode/init.js`                       | utility    | file-I/O + transform     | `.claude/hooks/gsd-context-monitor.js` | role-match    |
| `.claude/advisor-mode/tests/advisor-agent.test.js`   | test       | transform                | none                                   | none          |
| `.claude/advisor-mode/tests/boundary.test.js`        | test       | transform                | none                                   | none          |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | test       | file-I/O                 | none                                   | none          |
| `.claude/advisor-mode/tests/init.test.js`            | test       | file-I/O + transform     | none                                   | none          |
| `.advisor/audit/.gitkeep`                            | config     | file-I/O                 | none                                   | none          |
| `.advisor/state/.gitkeep`                            | config     | file-I/O                 | none                                   | none          |

## Pattern Assignments

### `.claude/agents/advisor-reviewer.md` (provider, request-response)

**Analog:** `.claude/agents/gsd-code-reviewer.md`

**Frontmatter pattern** (lines 1-8):

```markdown
---
name: gsd-code-reviewer
description: Reviews source files for bugs, security issues, and code quality problems. Produces structured REVIEW.md with severity-classified findings. Spawned by /gsd:code-review.
tools: Read, Write, Bash, Grep, Glob
color: "#F59E0B"
# hooks:
#   - before_write
---
```

**Apply with changes:** Use the same Markdown/YAML frontmatter shape, but Phase 1 advisor must set `model: opus` and `tools: Read, Grep, Glob` only. Do not copy mutating tools from the analog.

**Role and verdict-first pattern** (lines 10-18, 31-34):

```markdown
<role>
Source files from a completed implementation have been submitted for adversarial review. Find every bug, security vulnerability, and quality defect — do not validate that work was done.

Spawned by `/gsd:code-review` workflow. You produce REVIEW.md artifact in the phase directory.

**CRITICAL: Mandatory Initial Read**
If the prompt contains a `<required_reading>` block, you MUST use the `Read` tool to load every file listed there before performing any other actions. This is your primary context.
</role>

**Required finding classification:** Every finding in REVIEW.md must carry:

- **BLOCKER** — incorrect behavior, security vulnerability, or data loss risk; must be fixed before this code ships
- **WARNING** — degrades quality, maintainability, or robustness; should be fixed
```

**Output structure pattern** (lines 258-287):

````markdown
<step name="write_review">
**1. Create REVIEW.md** at `review_path` (if provided) or `{phase_dir}/{phase}-REVIEW.md`

**2. YAML frontmatter:**

```yaml
---
phase: XX-name
reviewed: YYYY-MM-DDTHH:MM:SSZ
depth: quick | standard | deep
files_reviewed: N
files_reviewed_list:
  - path/to/file1.ext
findings:
  critical: N
  warning: N
  info: N
  total: N
status: clean | issues_found
---
```
````

````

**Planner note:** Advisor output should adapt this structure into verdict-first sections: status/risk, blocking findings, recommended action, verification guidance.

---

### `.claude/agents/executor-guidance.md` (provider, request-response)

**Analog:** `.claude/agents/gsd-executor.md`

**Frontmatter and mutating executor tool pattern** (lines 1-12):
```markdown
---
name: gsd-executor
description: Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management. Spawned by execute-phase orchestrator or execute-plan command.
tools: Read, Write, Edit, Bash, Grep, Glob, mcp__context7__*
color: yellow
# hooks:
#   PostToolUse:
#     - matcher: "Write|Edit"
#       hooks:
#         - type: command
#           command: "npx eslint --fix $FILE 2>/dev/null || true"
---
````

**Executor boundary pattern** (lines 14-20, 58-68):

```markdown
<role>
You are a GSD plan executor. You execute PLAN.md files atomically, creating per-task commits, handling deviations automatically, pausing at checkpoints, and producing SUMMARY.md files.

Spawned by `/gsd:execute-phase` orchestrator.

Your job: Execute the plan completely, commit each task, create SUMMARY.md, update STATE.md.
</role>

<project_context>
Before executing, discover project context:

**Project instructions:** Read `./CLAUDE.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.
```

**Commit/verification discipline pattern** (lines 477-528):

````markdown
**1. Check modified files:** `git status --short`

**2. Stage task-related files individually** (NEVER `git add .` or `git add -A`):

```bash
git add src/api/auth.ts
git add src/types/user.ts
```
````

**3. Commit type:**

| Type       | When                                    |
| ---------- | --------------------------------------- |
| `feat`     | New feature, endpoint, component        |
| `fix`      | Bug fix, error correction               |
| `test`     | Test-only changes (TDD RED)             |
| `refactor` | Code cleanup, no behavior change        |
| `docs`     | Documentation only                      |
| `style`    | Formatting, whitespace, no logic change |
| `chore`    | Config, tooling, dependencies           |

````

**Planner note:** Use this only as executor-facing guidance. Do not place mutating tools in the advisor agent.

---

### `.claude/hooks/advisor-install-audit.js` (middleware, event-driven + file-I/O)

**Analog:** `.claude/hooks/gsd-context-monitor.js`

**CommonJS imports pattern** (lines 21-24):
```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
````

**Hook stdin parse and timeout guard pattern** (lines 31-43):

```javascript
let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;
```

**Path traversal guard pattern** (lines 49-54):

```javascript
// Reject session IDs that contain path traversal sequences or path separators.
// session_id is used to construct file paths in /tmp — an unsanitized value
// could escape the temp directory and read or write arbitrary files.
if (/[/\\]|\.\./.test(sessionId)) {
  process.exit(0);
}
```

**Fire-and-forget subprocess pattern** (lines 137-155):

```javascript
if (isCritical && isGsdActive && !warnData.criticalRecorded) {
  try {
    const gsdTools = path.join(
      __dirname,
      "..",
      "get-shit-done",
      "bin",
      "gsd-tools.cjs",
    );
    const safeUsedPct = Number(usedPct) || 0;
    const stoppedAt = `context exhaustion at ${safeUsedPct}% (${new Date().toISOString().split("T")[0]})`;
    spawn(
      process.execPath,
      [gsdTools, "state", "record-session", "--stopped-at", stoppedAt],
      { cwd, detached: true, stdio: "ignore" },
    ).unref();
    warnData.criticalRecorded = true;
    fs.writeFileSync(warnPath, JSON.stringify(warnData));
  } catch {
    /* non-critical — don't let state recording break the hook */
  }
}
```

**Structured hook output pattern** (lines 180-187):

```javascript
const output = {
  hookSpecificOutput: {
    hookEventName: process.env.GEMINI_API_KEY ? "AfterTool" : "PostToolUse",
    additionalContext: message,
  },
};

process.stdout.write(JSON.stringify(output));
```

**Error handling pattern** (lines 188-191):

```javascript
} catch (e) {
  // Silent fail -- never block tool execution
  process.exit(0);
}
```

---

### `.claude/hooks/advisor-boundary-check.js` (middleware, event-driven + transform)

**Analog:** `.claude/hooks/gsd-workflow-guard.js`

**Imports and hook read pattern** (lines 14-24):

```javascript
const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
```

**Tool matcher / early return pattern** (lines 27-31):

```javascript
// Only guard Write and Edit tool calls
if (toolName !== "Write" && toolName !== "Edit") {
  process.exit(0);
}
```

**Config-gated behavior pattern** (lines 60-74):

```javascript
const cwd = data.cwd || process.cwd();
const configPath = path.join(cwd, ".planning", "config.json");
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config.hooks?.workflow_guard) {
      process.exit(0); // Guard disabled (default)
    }
  } catch (e) {
    process.exit(0);
  }
} else {
  process.exit(0); // No GSD project — don't guard
}
```

**Advisory output pattern** (lines 78-89):

```javascript
const output = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext:
      `⚠️ WORKFLOW ADVISORY: You're editing ${path.basename(filePath)} directly without a GSD command. ` +
      "This edit will not be tracked in STATE.md or produce a SUMMARY.md. " +
      "Consider using /gsd:fast for trivial fixes or /gsd:quick for larger changes " +
      "to maintain project state tracking. " +
      "If this is intentional (e.g., user explicitly asked for a direct edit), proceed normally.",
  },
};

process.stdout.write(JSON.stringify(output));
```

**Planner note:** Replace the advisory text with advisor-boundary validation results. Use plain text without emoji to match project communication preference if creating new text.

---

### `.claude/hooks/advisor-phase-audit.sh` (middleware, event-driven + transform)

**Analog:** `.claude/hooks/gsd-phase-boundary.sh`

**Bash launcher and opt-in config pattern** (lines 1-16):

```bash
#!/usr/bin/env bash
# gsd-hook-version: 1.42.3

# Check opt-in config — exit silently if not enabled
if [ -f .planning/config.json ]; then
  ENABLED=$(node -e "try{const c=require('./.planning/config.json');process.stdout.write(c.hooks?.community===true?'1':'0')}catch{process.stdout.write('0')}" 2>/dev/null)
  if [ "$ENABLED" != "1" ]; then exit 0; fi
else
  exit 0
fi
```

**JSON input extraction pattern** (lines 18-22):

```bash
INPUT=$(cat)

# Extract file_path from JSON using Node (handles escaping correctly)
FILE=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path||'')}catch{}})" 2>/dev/null)
```

**Structured JSON envelope pattern** (lines 31-45):

```bash
if [ "$PLANNING_MODIFIED" = "true" ]; then
  node -e '
    const file = process.argv[1];
    const additionalContext = ".planning/ file modified: " + file + "\n" +
      "Check: Should STATE.md be updated to reflect this change?";
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
        planning_modified: true,
        file_path: file,
      },
    }));
  ' "$FILE"
fi

exit 0
```

---

### `.claude/settings.json` (config, event-driven)

**Analog:** `.claude/settings.json`

**Hook grouping pattern** (lines 1-10):

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
      },
```

**PostToolUse matcher with command and timeout pattern** (lines 29-39):

```json
"PostToolUse": [
  {
    "matcher": "Bash|Edit|Write|MultiEdit|Agent|Task",
    "hooks": [
      {
        "type": "command",
        "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/gsd-context-monitor.js",
        "timeout": 10
      }
    ]
  },
```

**PreToolUse matcher pattern** (lines 61-70):

```json
"PreToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [
      {
        "type": "command",
        "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/gsd-prompt-guard.js",
        "timeout": 5
      }
    ]
  },
```

**Planner note:** Merge advisor hooks into existing arrays. Preserve all existing `gsd-*` hook entries and unknown keys.

---

### `.claude/package.json` (config, request-response)

**Analog:** `.claude/package.json`

**CommonJS runtime marker** (line 1):

```json
{ "type": "commonjs" }
```

**Planner note:** Keep CommonJS for `.claude/hooks/*.js` and scaffold scripts. Add scripts only if tests/init commands need an npm entrypoint; otherwise leave minimal.

---

### `.claude/advisor-mode/README.md` (config, request-response)

**Analog:** `.claude/commands/gsd/new-project.md`

**Command documentation frontmatter pattern** (lines 1-12):

```markdown
---
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - AskUserQuestion
requires: [config, phase, plan-phase]
---
```

**Objective creates-list pattern** (lines 22-34):

```markdown
<objective>
Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

**Creates:**

- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

**After this command:** Run `/gsd:plan-phase 1` to start execution.
</objective>
```

**Process pattern** (lines 44-47):

```markdown
<process>
Execute end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).
</process>
```

**Planner note:** README can reuse the creates-list and process shape without command frontmatter.

---

### `.claude/advisor-mode/policy.example.json` (config, transform)

**Analog:** `.claude/settings.json`

**Nested project config shape** (lines 1-4, 61-64):

```json
{
  "hooks": {
    "SessionStart": [
      {
```

```json
"PreToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [
```

**Planner note:** Use indented, deterministic JSON with clear top-level categories. Keep examples versioned under `.claude/advisor-mode/`, not runtime state.

---

### `.claude/advisor-mode/verdict.schema.json` (config, transform)

**Analog:** `.claude/settings.json`

**Deterministic JSON formatting pattern** (lines 1-10):

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
      },
```

**Planner note:** Use the same two-space JSON formatting. Schema should validate verdict-first advisor output: status/risk/confidence/blocking findings/recommended actions/verification guidance.

---

### `.claude/advisor-mode/init.js` (utility, file-I/O + transform)

**Analog:** `.claude/hooks/gsd-context-monitor.js` and `.claude/hooks/gsd-workflow-guard.js`

**Filesystem and path imports** (`gsd-context-monitor.js` lines 21-24):

```javascript
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
```

**Project-relative config read** (`gsd-workflow-guard.js` lines 60-66):

```javascript
const cwd = data.cwd || process.cwd();
const configPath = path.join(cwd, '.planning', 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.hooks?.workflow_guard) {
```

**Settings/state write pattern** (`gsd-context-monitor.js` lines 124-127):

```javascript
// Reset debounce counter
warnData.callsSinceWarn = 0;
warnData.lastLevel = currentLevel;
fs.writeFileSync(warnPath, JSON.stringify(warnData));
```

**Planner note:** For init, write JSON as `JSON.stringify(value, null, 2) + "\n"` rather than compact JSON. Make settings merge idempotent by command path.

## Shared Patterns

### Claude Code agent frontmatter

**Source:** `.claude/agents/gsd-code-reviewer.md` and `.claude/agents/gsd-executor.md`
**Apply to:** `.claude/agents/advisor-reviewer.md`, `.claude/agents/executor-guidance.md`

```markdown
---
name: gsd-code-reviewer
description: Reviews source files for bugs, security issues, and code quality problems. Produces structured REVIEW.md with severity-classified findings. Spawned by /gsd:code-review.
tools: Read, Write, Bash, Grep, Glob
color: "#F59E0B"
---
```

**Important adaptation:** Advisor must use only `tools: Read, Grep, Glob`; executor guidance may document mutating executor authority but should not undermine advisor read-only boundary.

### Hook stdin parsing and silent failure

**Source:** `.claude/hooks/gsd-workflow-guard.js`
**Apply to:** All new `.claude/hooks/*.js`

```javascript
let input = "";
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    // ...hook logic...
  } catch (e) {
    // Silent fail — never block tool execution
    process.exit(0);
  }
});
```

### Hook response envelope

**Source:** `.claude/hooks/gsd-context-monitor.js`
**Apply to:** All non-blocking Phase 1 hooks

```javascript
const output = {
  hookSpecificOutput: {
    hookEventName: process.env.GEMINI_API_KEY ? "AfterTool" : "PostToolUse",
    additionalContext: message,
  },
};

process.stdout.write(JSON.stringify(output));
```

### Settings hook wiring

**Source:** `.claude/settings.json`
**Apply to:** `.claude/settings.json` merge actions

```json
{
  "matcher": "Bash|Edit|Write|MultiEdit|Agent|Task",
  "hooks": [
    {
      "type": "command",
      "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/gsd-context-monitor.js",
      "timeout": 10
    }
  ]
}
```

### CommonJS runtime

**Source:** `.claude/package.json`
**Apply to:** `.claude/hooks/*.js`, `.claude/advisor-mode/init.js`, tests

```json
{ "type": "commonjs" }
```

### Documented scaffold flow

**Source:** `.claude/commands/gsd/new-project.md`
**Apply to:** `.claude/advisor-mode/README.md`, optional command docs

```markdown
**Creates:**

- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory
```

## No Analog Found

Files with no close match in the codebase. Planner should use RESEARCH.md patterns and Node built-in `node:test` guidance for these.

| File                                                 | Role   | Data Flow            | Reason                                           |
| ---------------------------------------------------- | ------ | -------------------- | ------------------------------------------------ |
| `.claude/advisor-mode/tests/advisor-agent.test.js`   | test   | transform            | No existing JS test files found in repository    |
| `.claude/advisor-mode/tests/boundary.test.js`        | test   | transform            | No existing JS test files found in repository    |
| `.claude/advisor-mode/tests/scaffold-layout.test.js` | test   | file-I/O             | No existing JS test files found in repository    |
| `.claude/advisor-mode/tests/init.test.js`            | test   | file-I/O + transform | No existing JS test files found in repository    |
| `.advisor/audit/.gitkeep`                            | config | file-I/O             | No existing runtime directory placeholders found |
| `.advisor/state/.gitkeep`                            | config | file-I/O             | No existing runtime directory placeholders found |

## Metadata

**Analog search scope:** `.claude/agents/`, `.claude/hooks/`, `.claude/commands/`, `.claude/settings.json`, `.claude/package.json`, repository test files
**Files scanned:** 40+ Claude asset files, 0 test files found
**Project skills:** none found under `.claude/skills/` or `.agents/skills/`
**Pattern extraction date:** 2026-05-19
