# Phase 1: Repo-Scoped Advisor Foundation - Research

**Researched:** 2026-05-19
**Domain:** Claude Code project-scoped subagents, hooks, settings, and local scaffold assets
**Confidence:** MEDIUM-HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Asset Layout

- **D-01:** Phase 1 will place versioned advisor-mode assets inside the repository under `.claude/`, not in user-global config or an external control plane.
- **D-02:** The scaffold should use `.claude/agents/` for role definitions, `.claude/hooks/` for enforcement scripts, `.claude/settings.json` for hook wiring, and `.claude/advisor-mode/` for versioned policy/schema examples.
- **D-03:** The implementation should extend the repo’s existing `.claude` layout and script-launch pattern rather than inventing a second configuration surface.

#### Advisor Boundary

- **D-04:** The advisor role is structurally read-only in Phase 1 and must not receive mutating tools such as `Bash`, `Write`, `Edit`, or `MultiEdit`.
- **D-05:** The executor remains the only actor allowed to mutate the workspace and run implementation tools.
- **D-06:** Even in the scaffold phase, advisor outputs should be verdict-first and structured around risk, blocking findings, recommended actions, and verification guidance.

#### Scaffold Experience

- **D-07:** Phase 1 should ship a single documented scaffold/init flow that writes the baseline agent definitions, hooks, settings integration, policy examples, and runtime directory placeholders.
- **D-08:** The scaffold should be repo-scoped and local-first; it must not require a hosted bootstrap service or opaque remote control plane.
- **D-09:** Phase 1 validation should focus on local install correctness (files present, permissions correct, settings wired) rather than provider or routing conformance.

#### Runtime State & Audit Baseline

- **D-10:** Versioned policy and schema examples live under `.claude/advisor-mode/`; runtime state and audit artifacts live in local hidden runtime directories, not in planning docs.
- **D-11:** The initial audit baseline should use append-only local JSONL events sufficient to prove scaffold installation, advisor verdict receipt, and executor follow-up.
- **D-12:** Runtime artifacts should be designed for local inspection first and excluded from normal versioned planning documents unless explicitly promoted later.

### Claude's Discretion

- The planner may choose exact scaffold command names and exact file names under `.claude/advisor-mode/`, as long as the repo-scoped layout, read-only advisor boundary, and local-first runtime split above remain intact.
- The planner may choose whether runtime audit/state defaults are split across `.claude/advisor-state/`, `.advisor/`, or an equivalent hidden project-local runtime directory, as long as versioned policy stays separate from runtime artifacts.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                          | Research Support                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGNT-01 | Project maintainer can define an advisor agent that uses a stronger model alias and only read-only review tools                                      | Claude Code project subagents live in `.claude/agents/`, use Markdown plus YAML frontmatter, and support `model` and `tools` fields. [CITED: code.claude.com/docs/en/sub-agents]                                                                                                                                     |
| AGNT-02 | User can run an executor-led workflow where only the executor is allowed to mutate the workspace and run implementation tools                        | Phase 1 should grant the advisor only read-only tools via the subagent `tools` field and leave mutating tools available to the executor workflow outside the advisor agent. [CITED: code.claude.com/docs/en/sub-agents] [VERIFIED: codebase Read `.planning/phases/01-repo-scoped-advisor-foundation/01-CONTEXT.md`] |
| AGNT-03 | Project maintainer can version advisor-mode behavior as project-scoped Claude Code assets inside the repository                                      | Claude Code supports project subagents under `.claude/agents/` and shared project settings under `.claude/settings.json`; project settings can be checked into source control. [CITED: code.claude.com/docs/en/sub-agents] [CITED: code.claude.com/docs/en/settings]                                                 |
| SETP-01 | Project maintainer can scaffold advisor-mode agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow | Existing project Claude automation already uses `.claude/settings.json`, `.claude/hooks/`, and Node/Bash command hooks, so the scaffold should extend those assets. [VERIFIED: codebase Read `.claude/settings.json`, `.claude/hooks/`, `.claude/package.json`]                                                      |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Respond concisely and action-first. [VERIFIED: codebase Read `CLAUDE.md`]
- Provide crisp recommendations with trade-offs when choices matter. [VERIFIED: codebase Read `CLAUDE.md`]
- Ground recommendations in official documentation and current references first. [VERIFIED: codebase Read `CLAUDE.md`]
- Stay tightly within requested scope and ask before adding adjacent improvements. [VERIFIED: codebase Read `CLAUDE.md`]
- Use GSD workflow entry points before file-changing work unless explicitly bypassed. [VERIFIED: codebase Read `CLAUDE.md`]
- Project goal requires a pure client-side Advisor Mode that does not depend on `server_tool_use` or hosted control planes. [VERIFIED: codebase Read `CLAUDE.md`; `.planning/PROJECT.md`]
- Advisor must remain read-only and executor owns mutation. [VERIFIED: codebase Read `CLAUDE.md`; `.planning/REQUIREMENTS.md`]

## Summary

Phase 1 is a repo-scoped Claude Code asset foundation, not a provider-routing or enforcement-gate phase. [VERIFIED: codebase Read `.planning/ROADMAP.md`; `.planning/phases/01-repo-scoped-advisor-foundation/01-CONTEXT.md`] The planner should create deterministic project assets under `.claude/`: advisor/executor agent definitions, baseline hook scripts, `.claude/settings.json` integration, versioned policy/schema examples, and a local runtime/audit directory placeholder. [VERIFIED: codebase Read `01-CONTEXT.md`] [CITED: code.claude.com/docs/en/sub-agents] [CITED: code.claude.com/docs/en/settings]

Use Claude Code-native subagents and hooks rather than a custom orchestrator. [VERIFIED: codebase Read `CLAUDE.md`; `.planning/PROJECT.md`] Claude Code official docs identify project subagents in `.claude/agents/`, frontmatter fields including `name`, `description`, `tools`, and `model`, and model aliases such as `sonnet`, `opus`, and `haiku`. [CITED: code.claude.com/docs/en/sub-agents] Claude Code official settings docs identify shared project settings at `.claude/settings.json`, local project settings at `.claude/settings.local.json`, user settings at `~/.claude/settings.json`, and permission controls under `permissions.allow`, `permissions.ask`, and `permissions.deny`. [CITED: code.claude.com/docs/en/settings] [CITED: code.claude.com/docs/en/permissions]

**Primary recommendation:** Build a zero-new-dependency Node/CommonJS scaffold that writes static Claude Code project assets, validates advisor frontmatter for `model: opus` plus read-only `tools`, extends existing `.claude/settings.json` hook arrays without overwriting existing GSD hooks, and creates gitignored local runtime/audit directories. [VERIFIED: codebase Read `.claude/package.json`; `.claude/settings.json`] [ASSUMED]

## Architectural Responsibility Map

| Capability                         | Primary Tier                              | Secondary Tier                | Rationale                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scaffold project assets            | Local CLI / project script                | Filesystem                    | The init flow writes repo-local `.claude` assets and runtime directory placeholders. [VERIFIED: codebase Read `01-CONTEXT.md`]                                                                                                                         |
| Advisor role definition            | Claude Code subagent layer                | Project repository            | Project subagents are Markdown files under `.claude/agents/` with frontmatter fields such as `tools` and `model`. [CITED: code.claude.com/docs/en/sub-agents]                                                                                          |
| Executor/advisor mutation boundary | Claude Code permissions / subagent tools  | Hook validation               | The advisor boundary is primarily enforced by granting only read-only tools in its subagent definition; hook validation should detect scaffold drift. [CITED: code.claude.com/docs/en/sub-agents] [VERIFIED: codebase Read `01-CONTEXT.md`]            |
| Settings integration               | Claude Code settings                      | Hook scripts                  | Hook registration belongs in `.claude/settings.json`; existing project hooks already use command entries with `matcher`, `type`, `command`, and `timeout`. [CITED: code.claude.com/docs/en/settings] [VERIFIED: codebase Read `.claude/settings.json`] |
| Runtime audit baseline             | Local filesystem runtime directory        | Hook scripts                  | Runtime audit artifacts are local hidden files, separate from versioned policy/schema examples. [VERIFIED: codebase Read `01-CONTEXT.md`]                                                                                                              |
| Validation                         | Node built-in test runner / script checks | Manual Claude Code smoke test | The repo currently has no detected test framework; Node is available locally and official Node docs support `node --test`. [VERIFIED: environment probe] [CITED: nodejs.org/api/test.html]                                                             |

## Standard Stack

### Core

| Library / Tool                | Version                   | Purpose                                                         | Why Standard                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code project subagents | Current docs              | Advisor/executor role definitions under `.claude/agents/`       | Official Claude Code docs define project subagents in `.claude/agents/` with Markdown/YAML frontmatter. [CITED: code.claude.com/docs/en/sub-agents]                                                                                                 |
| Claude Code project settings  | Current docs              | Shared repo-scoped hook wiring in `.claude/settings.json`       | Official settings docs define shared project settings and hook-related configuration through `settings.json`. [CITED: code.claude.com/docs/en/settings]                                                                                             |
| Claude Code hooks             | Current docs              | Scaffold install/audit hooks and future enforcement integration | Official hooks docs define hook lifecycle events including `PreToolUse`, `PostToolUse`, `Stop`, and `SubagentStop`, plus command hooks and matchers. [CITED: code.claude.com/docs/en/hooks]                                                         |
| Node.js                       | v25.9.0 available locally | Scaffold script, validation script, and JSON manipulation       | Existing `.claude/package.json` declares CommonJS and existing hooks use Node scripts, so Phase 1 should reuse Node/CommonJS. [VERIFIED: environment probe] [VERIFIED: codebase Read `.claude/package.json`; `.claude/hooks/gsd-workflow-guard.js`] |
| Node built-in test runner     | Bundled with Node         | Unit/smoke tests without external packages                      | Official Node docs document `node:test` and `node --test`, avoiding external package installation in Phase 1. [CITED: nodejs.org/api/test.html]                                                                                                     |

### Supporting

| Library / Tool | Version                  | Purpose                                                    | When to Use                                                                                                                                                                                     |
| -------------- | ------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git            | 2.54.0 available locally | Verify versioned assets and ignored runtime artifacts      | Use in validation to confirm scaffolded policy files are trackable and runtime audit files are ignored or untracked. [VERIFIED: environment probe]                                              |
| Bash           | System shell available   | Thin launchers where existing hook style already uses Bash | Use only for simple wrappers; keep JSON parsing and settings edits in Node to match existing patterns. [VERIFIED: codebase Read `.claude/settings.json`; `.claude/hooks/gsd-phase-boundary.sh`] |

### Alternatives Considered

| Instead of                                  | Could Use                             | Tradeoff                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero-new-dependency Node/CommonJS           | TypeScript + Commander + Zod          | TypeScript/Zod are useful later for policy schemas, but Phase 1 can scaffold static assets and run shape checks with Node stdlib, avoiding package legitimacy and install work. [ASSUMED] |
| Static scaffold templates                   | Runtime YAML frontmatter parser       | Static templates reduce dependencies; parser is only needed if Phase 1 must round-trip arbitrary agent files. [ASSUMED]                                                                   |
| Project `.claude/settings.json` integration | User-global `~/.claude/settings.json` | User-global settings are not repo-versioned and conflict with AGNT-03. [CITED: code.claude.com/docs/en/settings] [VERIFIED: codebase Read `.planning/REQUIREMENTS.md`]                    |

**Installation:**

```bash
# No external package installation recommended for Phase 1.
# Use existing Node.js and project-local .claude assets.
```

**Version verification:** Node, npm, git, and Python were probed locally on 2026-05-19. [VERIFIED: environment probe]

## Package Legitimacy Audit

Phase 1 should install no external packages. [ASSUMED]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition                 |
| ------- | -------- | --- | --------- | ----------- | --------- | --------------------------- |
| none    | —        | —   | —         | —           | not run   | No package install required |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Maintainer runs scaffold/init flow
        |
        v
Node/CommonJS scaffold script
        |
        +--> write/update .claude/agents/advisor*.md
        |       |
        |       v
        |   Claude Code subagent registry uses project advisor definition
        |
        +--> write/update .claude/advisor-mode/* policy/schema examples
        |
        +--> merge hook entries into .claude/settings.json
        |       |
        |       v
        |   Claude Code hook lifecycle invokes project command hooks
        |
        +--> create local hidden runtime/audit directories
                |
                v
        append-only JSONL baseline events for install/verdict/follow-up

Executor workflow remains primary actor
        |
        +--> executor may use mutating tools
        |
        +--> advisor subagent receives only read-only review tools
```

### Recommended Project Structure

```text
.claude/
├── agents/
│   ├── advisor-reviewer.md        # read-only advisor subagent definition [ASSUMED filename]
│   └── executor-guidance.md        # executor-facing role guidance, non-authoritative policy [ASSUMED filename]
├── hooks/
│   ├── advisor-install-audit.js    # append scaffold/install events [ASSUMED filename]
│   └── advisor-boundary-check.js   # validate advisor asset shape [ASSUMED filename]
├── advisor-mode/
│   ├── README.md                   # documented setup flow and operator notes [ASSUMED filename]
│   ├── policy.example.json         # versioned policy example [ASSUMED filename]
│   └── verdict.schema.json         # versioned verdict contract example [ASSUMED filename]
└── settings.json                   # merged hook wiring, preserving existing GSD hooks

.advisor/
├── audit/.gitkeep                  # local runtime audit placeholder [ASSUMED path]
└── state/.gitkeep                  # local runtime state placeholder [ASSUMED path]
```

### Pattern 1: Project-local subagent with explicit read-only tools

**What:** Define the advisor as a Claude Code project subagent Markdown file with YAML frontmatter and an explicit `tools` allowlist containing only read-only tools. [CITED: code.claude.com/docs/en/sub-agents]

**When to use:** Always for AGNT-01 and AGNT-02; omission of `tools` is unsafe because docs indicate omitted `tools` can inherit available tools. [CITED: docs.claude.com/en/docs/claude-code/sub-agents]

**Example:**

```markdown
---
name: advisor-reviewer
description: Read-only architecture, risk, and verification advisor for Advisor Mode.
model: opus
tools: Read, Grep, Glob
---

Return verdict-first review only. Do not edit files, run commands, or request mutating tools.
```

### Pattern 2: Merge settings, do not overwrite settings

**What:** Add advisor hook entries to the existing `.claude/settings.json` by preserving current hook arrays and appending only Advisor Mode entries. [VERIFIED: codebase Read `.claude/settings.json`]

**When to use:** During scaffold/init and validation; the repo already has `SessionStart`, `PreToolUse`, and `PostToolUse` hooks. [VERIFIED: codebase Read `.claude/settings.json`]

**Example:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Agent|Task",
        "hooks": [
          {
            "type": "command",
            "command": "\"/usr/bin/node\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/advisor-install-audit.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Pattern 3: Hook output uses one control channel

**What:** For hook control, use either exit codes or structured JSON output, not both. [CITED: code.claude.com/docs/en/hooks]

**When to use:** All hook scripts; Phase 1 hooks should usually emit structured JSON on stdout with exit code `0` for additional context/audit signals, and reserve exit code `2` blocking for later enforcement phases. [CITED: code.claude.com/docs/en/hooks] [VERIFIED: codebase Read `.planning/ROADMAP.md`]

**Example:**

```javascript
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "Advisor Mode scaffold audit event recorded.",
    },
  }),
);
process.exit(0);
```

### Anti-Patterns to Avoid

- **Implicit advisor tools:** Omitting `tools` can allow inherited tool access; explicitly list read-only tools. [CITED: docs.claude.com/en/docs/claude-code/sub-agents]
- **Overwriting `.claude/settings.json`:** The repo already has GSD hooks; replacement would break existing project automation. [VERIFIED: codebase Read `.claude/settings.json`]
- **Provider conformance in Phase 1:** Provider routing and conformance are Phase 4 scope. [VERIFIED: codebase Read `.planning/ROADMAP.md`]
- **Gate enforcement in Phase 1:** High-risk action gates are Phase 2 scope. [VERIFIED: codebase Read `.planning/ROADMAP.md`]
- **Runtime audit under `.planning/`:** Phase context requires runtime artifacts to stay separate from planning docs. [VERIFIED: codebase Read `01-CONTEXT.md`]

## Don't Hand-Roll

| Problem             | Don't Build                             | Use Instead                                  | Why                                                                                                                                      |
| ------------------- | --------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Agent role registry | Custom agent loader                     | Claude Code `.claude/agents/*.md`            | Official project subagents already provide repo-scoped role definitions. [CITED: code.claude.com/docs/en/sub-agents]                     |
| Hook lifecycle      | Custom daemon or watcher                | Claude Code hooks in `.claude/settings.json` | Official hooks run at defined lifecycle events and support tool matchers. [CITED: code.claude.com/docs/en/hooks]                         |
| Settings precedence | Bespoke config hierarchy                | Claude Code settings scopes                  | Official settings already define shared project, local project, user, CLI, and managed scopes. [CITED: code.claude.com/docs/en/settings] |
| Read-only boundary  | Prompt-only instructions                | Subagent `tools` allowlist plus validation   | Prompt text alone cannot structurally remove tools; explicit tool lists do. [CITED: code.claude.com/docs/en/sub-agents] [ASSUMED]        |
| Test framework      | Install Jest/Vitest for scaffold checks | Node built-in `node:test`                    | Phase 1 does not need external test dependencies; Node official docs support `node --test`. [CITED: nodejs.org/api/test.html]            |

**Key insight:** The foundation should be Claude Code-native assets plus small validation scripts; a separate orchestration runtime duplicates capabilities Claude Code already exposes. [VERIFIED: codebase Read `.planning/PROJECT.md`] [CITED: code.claude.com/docs/en/sub-agents] [CITED: code.claude.com/docs/en/hooks]

## Common Pitfalls

### Pitfall 1: Advisor inherits mutating tools

**What goes wrong:** The advisor can call `Bash`, `Edit`, `Write`, or `MultiEdit` if the agent definition omits or misconfigures its `tools` field. [CITED: docs.claude.com/en/docs/claude-code/sub-agents] [VERIFIED: codebase Read `01-CONTEXT.md`]
**Why it happens:** Claude Code docs indicate omitted `tools` can inherit available tools. [CITED: docs.claude.com/en/docs/claude-code/sub-agents]
**How to avoid:** Scaffold `tools: Read, Grep, Glob` and add a validation check that fails when mutating tool names appear in advisor frontmatter. [CITED: code.claude.com/docs/en/sub-agents] [ASSUMED]
**Warning signs:** Advisor agent files contain `Bash`, `Edit`, `Write`, `MultiEdit`, wildcard-like tool grants, or no `tools` field. [ASSUMED]

### Pitfall 2: Settings merge breaks existing GSD hooks

**What goes wrong:** Scaffold replaces existing hook arrays and removes current GSD guard/monitor hooks. [VERIFIED: codebase Read `.claude/settings.json`]
**Why it happens:** Naive init scripts write a fresh settings file instead of merging entries. [ASSUMED]
**How to avoid:** Read existing JSON, append idempotent Advisor Mode entries, sort or identify entries by command path, and preserve unknown keys. [ASSUMED]
**Warning signs:** Diff shows deleted `gsd-*` hook commands. [VERIFIED: codebase Read `.claude/settings.json`]

### Pitfall 3: Mixing hook blocking mechanisms

**What goes wrong:** A hook emits JSON and exits with code `2`, but Claude Code ignores stdout JSON for exit code `2`. [CITED: code.claude.com/docs/en/hooks]
**Why it happens:** Hooks support both exit-code and JSON control paths, but official docs warn not to mix them. [CITED: code.claude.com/docs/en/hooks]
**How to avoid:** Phase 1 should use exit `0` plus structured JSON for advisory/audit output; later blocking hooks can use exit `2` with stderr or structured block JSON with exit `0`. [CITED: code.claude.com/docs/en/hooks] [ASSUMED]
**Warning signs:** Hook tests expect JSON parsing after `exit 2`. [CITED: code.claude.com/docs/en/hooks]

### Pitfall 4: Conflating versioned policy with runtime audit

**What goes wrong:** Generated JSONL logs are committed or stored under `.planning/`. [VERIFIED: codebase Read `01-CONTEXT.md`]
**Why it happens:** Scaffold creates only one directory for all Advisor Mode files. [ASSUMED]
**How to avoid:** Put versioned examples in `.claude/advisor-mode/`; put local JSONL/state under `.advisor/` or equivalent hidden runtime directory and ignore generated logs. [VERIFIED: codebase Read `01-CONTEXT.md`] [ASSUMED]
**Warning signs:** `git status` shows `.advisor/audit/*.jsonl` or `.planning/*` runtime events. [ASSUMED]

## Code Examples

Verified patterns from official sources and existing repo patterns:

### Advisor agent definition

```markdown
---
name: advisor-reviewer
description: Use for read-only architecture, risk, and verification review before executor decisions.
model: opus
tools: Read, Grep, Glob
---

Return a structured verdict with risk, confidence, blocking findings, recommended next actions, and validation guidance.
```

Source: project subagents support `.claude/agents/`, `model`, and `tools`; model aliases include `opus`. [CITED: code.claude.com/docs/en/sub-agents]

### Idempotent settings merge shape

```javascript
const fs = require("fs");
const settingsPath = ".claude/settings.json";
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
settings.hooks ||= {};
settings.hooks.PostToolUse ||= [];
// Append only if the advisor command is not already present.
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
```

Source: existing hooks are command entries in `.claude/settings.json`; Node/CommonJS is the existing hook runtime convention. [VERIFIED: codebase Read `.claude/settings.json`; `.claude/package.json`]

### Node built-in scaffold test

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");

test("advisor tools are read-only", () => {
  const tools = ["Read", "Grep", "Glob"];
  assert.deepEqual(tools.sort(), ["Glob", "Grep", "Read"]);
});
```

Source: Node official docs document `node:test`, `node --test`, and assertions through Node APIs. [CITED: nodejs.org/api/test.html]

## State of the Art

| Old Approach                               | Current Approach                                                                         | When Changed             | Impact                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| User-global Claude Code configuration only | Shared project settings in `.claude/settings.json` plus local/user scopes                | Current Claude Code docs | Phase 1 can version behavior in repo while leaving personal overrides local. [CITED: code.claude.com/docs/en/settings]    |
| Prompt-only specialist roles               | Project subagents with frontmatter `tools` and `model` fields                            | Current Claude Code docs | Advisor read-only boundary should be encoded structurally, not only in prose. [CITED: code.claude.com/docs/en/sub-agents] |
| Custom shell hooks only                    | Claude Code hook lifecycle with matchers, command hooks, exit codes, and structured JSON | Current Claude Code docs | Phase 1 can wire audit/boundary checks into official lifecycle points. [CITED: code.claude.com/docs/en/hooks]             |

**Deprecated/outdated:**

- Treating provider routing as Phase 1 scope: roadmap assigns provider routing and conformance to Phase 4. [VERIFIED: codebase Read `.planning/ROADMAP.md`]
- Letting advisor execute commands or edits: project requirements explicitly put advisor mutation out of scope. [VERIFIED: codebase Read `.planning/REQUIREMENTS.md`]

## Assumptions Log

| #   | Claim                                                                                                                                                     | Section                  | Risk if Wrong                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| A1  | Use a zero-new-dependency Node/CommonJS scaffold for Phase 1.                                                                                             | Summary / Standard Stack | If schema validation becomes complex immediately, planner may need a human-approved package choice.    |
| A2  | Suggested filenames such as `advisor-reviewer.md`, `advisor-install-audit.js`, `policy.example.json`, and `.advisor/` are defaults, not locked decisions. | Architecture Patterns    | Wrong names could conflict with maintainers' preferences but do not affect architecture.               |
| A3  | Static templates are enough; no YAML parser is required in Phase 1.                                                                                       | Standard Stack           | If validation must parse arbitrary edited frontmatter, a parser may be needed.                         |
| A4  | Prompt-only boundaries are insufficient without explicit tool allowlists.                                                                                 | Don't Hand-Roll          | If Claude Code adds stronger inherited policy controls, validation could be simplified.                |
| A5  | Runtime logs should be gitignored by default.                                                                                                             | Common Pitfalls          | If audit logs must be versioned for demos, planner must separate demo fixtures from live runtime logs. |

## Open Questions (RESOLVED)

1. **Exact runtime directory name**
   - What we know: Context allows `.claude/advisor-state/`, `.advisor/`, or equivalent hidden project-local runtime directory. [VERIFIED: codebase Read `01-CONTEXT.md`]
   - Resolution: Phase 1 uses `.advisor/` for generated runtime state and `.claude/advisor-mode/` for versioned policy/schema examples, matching the checked-in scaffold behavior and verification artifacts. [VERIFIED: codebase Read `.claude/advisor-mode/init.js`; `.claude/advisor-mode/tests/scaffold-layout.test.js`; `01-VERIFICATION.md`]
   - Final decision: Keep runtime state under `.advisor/`; do not colocate live runtime state under `.claude/` in Phase 1.

2. **Whether to scaffold an executor agent file**
   - What we know: Success criteria require executor-led workflow and executor-only mutation, while locked layout says `.claude/agents/` for role definitions. [VERIFIED: codebase Read `.planning/ROADMAP.md`; `01-CONTEXT.md`]
   - Resolution: Phase 1 scaffolds `advisor-reviewer.md` as the enforceable read-only subagent and uses `executor-guidance.md` as the executor-boundary artifact; it does not introduce a separate executor subagent file. [VERIFIED: codebase Read `.claude/advisor-mode/init.js`; `.claude/agents/executor-guidance.md`; `01-VERIFICATION.md`]
   - Final decision: Keep executor guidance as the Phase 1 boundary artifact unless a later phase explicitly requires a named executor agent.

3. **Hook event choice for Phase 1 baseline audit**
   - What we know: Claude Code hooks support `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, and `SubagentStop`; existing settings already use `SessionStart`, `PreToolUse`, and `PostToolUse`. [CITED: code.claude.com/docs/en/hooks] [VERIFIED: codebase Read `.claude/settings.json`]
   - Resolution: Phase 1 keeps the non-blocking install/boundary validation hooks and defers verdict-enforcement concerns such as `SubagentStop` output validation to later roadmap phases. [VERIFIED: codebase Read `.planning/ROADMAP.md`; `.claude/settings.json`; `01-VERIFICATION.md`]
   - Final decision: Leave verdict-enforcement hooks out of Phase 1 scope.

## Environment Availability

| Dependency | Required By                      | Available | Version | Fallback                                                                           |
| ---------- | -------------------------------- | --------- | ------- | ---------------------------------------------------------------------------------- |
| Node.js    | Scaffold and hook scripts        | yes       | v25.9.0 | None needed. [VERIFIED: environment probe]                                         |
| npm        | Optional future package install  | yes       | 10.33.0 | No package install recommended. [VERIFIED: environment probe]                      |
| git        | Versioning and ignore validation | yes       | 2.54.0  | None needed. [VERIFIED: environment probe]                                         |
| Python     | Not required by Phase 1          | yes       | 3.12.9  | Not used. [VERIFIED: environment probe]                                            |
| ctx7 CLI   | Documentation lookup fallback    | no        | —       | Used WebSearch official-doc result snippets instead. [VERIFIED: environment probe] |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**

- ctx7 CLI is unavailable; WebSearch returned official Claude Code documentation result snippets. [VERIFIED: environment probe] [CITED: code.claude.com/docs/en/sub-agents] [CITED: code.claude.com/docs/en/hooks]

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Framework          | Node built-in test runner (`node:test`) [CITED: nodejs.org/api/test.html]                            |
| Config file        | none — Wave 0 should add package scripts or direct commands [VERIFIED: codebase infrastructure scan] |
| Quick run command  | `node --test .claude/advisor-mode/**/*.test.js` [ASSUMED]                                            |
| Full suite command | `node --test` [CITED: nodejs.org/api/test.html]                                                      |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                  | Test Type             | Automated Command                                                | File Exists? |
| ------- | --------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- | ------------ |
| AGNT-01 | Advisor agent has `model: opus` and only `Read`, `Grep`, `Glob` tools                                     | unit / file-shape     | `node --test .claude/advisor-mode/tests/advisor-agent.test.js`   | No — Wave 0  |
| AGNT-02 | Mutating tools are absent from advisor assets and executor guidance keeps mutation with executor          | unit / file-shape     | `node --test .claude/advisor-mode/tests/boundary.test.js`        | No — Wave 0  |
| AGNT-03 | Versioned assets live under `.claude/` and runtime JSONL/state is not tracked as normal planning docs     | smoke                 | `node --test .claude/advisor-mode/tests/scaffold-layout.test.js` | No — Wave 0  |
| SETP-01 | Scaffold/init creates agents, hooks, settings integration, policy examples, and runtime dirs idempotently | integration / tempdir | `node --test .claude/advisor-mode/tests/init.test.js`            | No — Wave 0  |

### Sampling Rate

- **Per task commit:** `node --test .claude/advisor-mode/tests/*.test.js` [ASSUMED]
- **Per wave merge:** `node --test` [CITED: nodejs.org/api/test.html]
- **Phase gate:** Full suite green before `/gsd:verify-work`. [VERIFIED: codebase Read `.planning/config.json`]

### Wave 0 Gaps

- [ ] `.claude/advisor-mode/tests/advisor-agent.test.js` — covers AGNT-01. [ASSUMED]
- [ ] `.claude/advisor-mode/tests/boundary.test.js` — covers AGNT-02. [ASSUMED]
- [ ] `.claude/advisor-mode/tests/scaffold-layout.test.js` — covers AGNT-03. [ASSUMED]
- [ ] `.claude/advisor-mode/tests/init.test.js` — covers SETP-01. [ASSUMED]
- [ ] Optional package script in `.claude/package.json` or root package if introduced; currently `.claude/package.json` only declares CommonJS. [VERIFIED: codebase Read `.claude/package.json`]

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                              |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | No authentication flow in Phase 1. [VERIFIED: codebase Read `.planning/ROADMAP.md`]                                                                           |
| V3 Session Management | no      | No web/user session flow in Phase 1. [VERIFIED: codebase Read `.planning/ROADMAP.md`]                                                                         |
| V4 Access Control     | yes     | Enforce advisor tool boundary with subagent `tools` allowlist and validation. [CITED: code.claude.com/docs/en/sub-agents]                                     |
| V5 Input Validation   | yes     | Validate scaffolded JSON/settings shape before writing and validate generated agent frontmatter shape. [ASSUMED]                                              |
| V6 Cryptography       | no      | No cryptographic operation in Phase 1. [VERIFIED: codebase Read `.planning/ROADMAP.md`]                                                                       |
| V8 Data Protection    | yes     | Keep runtime audit/state local and separate from versioned planning docs. [VERIFIED: codebase Read `01-CONTEXT.md`]                                           |
| V14 Configuration     | yes     | Merge `.claude/settings.json` safely and preserve existing hooks. [CITED: code.claude.com/docs/en/settings] [VERIFIED: codebase Read `.claude/settings.json`] |

### Known Threat Patterns for Claude Code project assets

| Pattern                                      | STRIDE                 | Standard Mitigation                                                                                                                                     |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisor receives mutating tools              | Elevation of Privilege | Explicit `tools: Read, Grep, Glob`; automated validation blocks mutating tool names. [CITED: code.claude.com/docs/en/sub-agents] [ASSUMED]              |
| Malicious or accidental hook replacement     | Tampering              | Idempotent settings merge that preserves unknown keys and existing GSD hook commands. [VERIFIED: codebase Read `.claude/settings.json`] [ASSUMED]       |
| Runtime audit logs committed unintentionally | Information Disclosure | Store runtime JSONL in hidden local runtime directory and add ignore rules for generated logs. [VERIFIED: codebase Read `01-CONTEXT.md`] [ASSUMED]      |
| Hook script path injection                   | Tampering              | Use `$CLAUDE_PROJECT_DIR` and fixed project-relative command paths, matching existing settings style. [VERIFIED: codebase Read `.claude/settings.json`] |
| Hook hangs blocking workflow                 | Denial of Service      | Set short hook timeouts as existing settings do. [VERIFIED: codebase Read `.claude/settings.json`]                                                      |

## Sources

### Primary (HIGH confidence)

- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) — project subagent location, frontmatter fields, `tools`, and `model` aliases; accessed through WebSearch official-doc snippets because WebFetch was blocked by domain safety policy.
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) — hook lifecycle, matchers, command hooks, JSON/exit-code behavior; accessed through WebSearch official-doc snippets because WebFetch was blocked by domain safety policy.
- [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide) — practical hook settings examples and `PreToolUse` blocking pattern; accessed through WebSearch official-doc snippets.
- [Claude Code settings](https://code.claude.com/docs/en/settings) — settings scopes, shared project settings, env, hooks, and permissions settings; accessed through WebSearch official-doc snippets.
- [Claude Code permissions](https://code.claude.com/docs/en/permissions) — permission precedence and deny/ask/allow behavior; accessed through WebSearch official-doc snippets.
- [Node.js test runner](https://nodejs.org/api/test.html) — `node:test` and `node --test`; accessed through WebSearch official-doc snippets.
- Codebase reads: `.planning/phases/01-repo-scoped-advisor-foundation/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/config.json`, `CLAUDE.md`, `.claude/settings.json`, `.claude/package.json`, `.claude/hooks/gsd-workflow-guard.js`, `.claude/hooks/gsd-phase-boundary.sh`, `.claude/hooks/gsd-context-monitor.js`.

### Secondary (MEDIUM confidence)

- [Anthropic-hosted subagents mirror](https://docs.claude.com/en/docs/claude-code/sub-agents) — confirms project subagent location and inheritance behavior in WebSearch snippets.
- [Anthropic-hosted settings mirror](https://docs.claude.com/en/docs/claude-code/settings) — confirms settings scope in WebSearch snippets.

### Tertiary (LOW confidence)

- Assumptions in the Assumptions Log, mostly exact filenames, runtime directory naming, and no-new-package implementation choice.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM-HIGH — Claude Code docs were found through official search snippets, but direct WebFetch and Context7 access were unavailable; local repo patterns were verified. [CITED: code.claude.com/docs/en/sub-agents] [VERIFIED: codebase Read]
- Architecture: HIGH — phase boundaries and layout are locked in CONTEXT.md and ROADMAP.md. [VERIFIED: codebase Read]
- Pitfalls: MEDIUM-HIGH — critical pitfalls are documented in official snippets and existing settings; exact implementation failures are inferred from common scaffold mistakes. [CITED: code.claude.com/docs/en/hooks] [ASSUMED]

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 for repo-local scaffold patterns; recheck Claude Code docs before implementing hooks or permission semantics.
