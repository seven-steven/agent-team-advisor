# Phase 05: audit-budget-and-operator-recovery - Research

**Researched:** 2026-05-29  
**Domain:** Claude Code 本地 hooks 运行时审计、预算硬限制、doctor 验证、rollback/kill switch 运营控制  
**Confidence:** HIGH

## User Constraints

No `05-CONTEXT.md` was present at research time; no additional locked decisions, discretion areas, or deferred ideas were provided for Phase 05. [VERIFIED: codebase]

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                        | Research Support                                                                                                                                                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUDT-01 | User can inspect an append-only local audit trail for advisor triggers, hook decisions, provider routes, advisor verdicts, and executor follow-up decisions. [VERIFIED: .planning/REQUIREMENTS.md] | Existing `.advisor/audit/events.jsonl` is already used by provider conformance, provider routing, executor decisions, and verification evidence; Phase 05 should centralize append-only audit writing and expose an inspection command. [VERIFIED: codebase] |
| AUDT-03 | User can correlate advisor-mode audit events with task or session identifiers. [VERIFIED: .planning/REQUIREMENTS.md]                                                                               | Existing artifacts already carry `correlationKey`; Phase 05 should add stable `taskId` / `sessionId` fields at hook ingress and propagate them through audit events. [VERIFIED: codebase]                                                                    |
| SAFE-01 | User can set hard limits for advisor calls, advisor tokens, or advisor latency per task or session. [VERIFIED: .planning/REQUIREMENTS.md]                                                          | Existing hooks run synchronously with timeout settings in `.claude/settings.json`; Phase 05 should add budget state and fail-closed/enforced budget decisions before advisor consultation proceeds. [VERIFIED: codebase]                                     |
| SAFE-03 | Project maintainer can disable advisor enforcement or switch to warning-only mode through a documented kill switch or rollback path. [VERIFIED: .planning/REQUIREMENTS.md]                         | Existing gate code already reads `.planning/config.json` hooks flags `advisor_mode` and `advisor_mode_strict`; Phase 05 should document and test disabled / advisory-only rollback behavior. [VERIFIED: codebase]                                            |
| SETP-02 | User can run a doctor or validation command that verifies required hooks, routes, advisor permissions, and project assets are installed correctly. [VERIFIED: .planning/REQUIREMENTS.md]           | Existing init/conformance commands and tests validate slices; Phase 05 should add one operator-facing doctor command that checks hooks, routes, permissions, runtime dirs, and current rollback/budget config. [VERIFIED: codebase]                          |

</phase_requirements>

## Summary

Phase 05 should not introduce a database, hosted control plane, or new dependency stack. The existing project is CommonJS Node scripts under `.claude/advisor-mode/` and `.claude/hooks/`, with ignored runtime state under a hashed per-project runtime root by default. [VERIFIED: codebase] Existing phases already append some JSONL events, write runtime artifacts, register hooks in project-local `.claude/settings.json`, and use `correlationKey` across consultation, verdict, executor decision, route, conformance, and verification flows. [VERIFIED: codebase]

The right plan is to consolidate runtime operations around four small primitives: `audit-log.js`, `budget-state.js`, `doctor.js`, and rollback documentation/tests. [ASSUMED] Audit should remain append-only JSONL because it matches existing Phase 1-4 artifacts and is inspectable with normal CLI tooling. [VERIFIED: codebase] Budget enforcement should be local, deterministic, and synchronous in hook paths because Claude Code hook commands already gate workflow decisions via stdout JSON / exit behavior and configured hook timeouts. [VERIFIED: codebase] Doctor should validate installed assets rather than mutate them by default. [ASSUMED]

**Primary recommendation:** implement Phase 05 as local CommonJS operational hardening: append-only audit writer/reader, correlation propagation, budget hard-stop checks, `advisor-mode doctor`, and tested kill-switch / warning-only rollback paths. [VERIFIED: codebase]

## Architectural Responsibility Map

| Capability                          | Primary Tier                 | Secondary Tier                     | Rationale                                                                                                                                                                        |
| ----------------------------------- | ---------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Append-only audit trail             | Local Runtime / Filesystem   | CLI                                | Audit events are produced by hooks and scripts, persisted under `.advisor/audit/events.jsonl`, and inspected by operator commands. [VERIFIED: codebase]                          |
| Correlation by task/session         | Local Runtime / Hook ingress | CLI                                | Existing artifacts already use `correlationKey`; task/session identifiers must be captured from hook input/env/options and copied into every audit event. [VERIFIED: codebase]   |
| Budget limits                       | Local Runtime / Hook policy  | Filesystem state                   | Hard limits must be checked before advisory escalation continues, and state belongs in ignored runtime paths under `.advisor/state` or hashed runtime root. [VERIFIED: codebase] |
| Kill switch / warning-only rollback | Project config               | Hook policy                        | Existing gates read `.planning/config.json` flags `advisor_mode` and `advisor_mode_strict`; project config owns enforcement mode. [VERIFIED: codebase]                           |
| Doctor validation                   | CLI                          | Filesystem / live optional gateway | Doctor checks repo assets, hook wiring, route files, advisor permissions, runtime dirs, and optional provider conformance evidence. [VERIFIED: codebase]                         |

## Project Constraints (from CLAUDE.md)

- Respond concisely and action-first. [VERIFIED: CLAUDE.md]
- Ground recommendations in official documentation and current references first. [VERIFIED: CLAUDE.md]
- Stay tightly within requested scope; avoid scope creep. [VERIFIED: CLAUDE.md]
- Architecture must remain pure client-side and must not depend on Anthropic `server_tool_use` / `advisor_20260301`. [VERIFIED: CLAUDE.md]
- Runtime must run in Claude Code / Claude Code Teams semantics using subagents, hooks, SendMessage, and local tools. [VERIFIED: CLAUDE.md]
- Model routing must remain compatible with Anthropic-compatible providers through Claude alias mapping. [VERIFIED: CLAUDE.md]
- Advisor must remain read-only. [VERIFIED: CLAUDE.md]
- Observability must be auditable and record trigger reason, model routing, token, latency, cost, and final decision. [VERIFIED: CLAUDE.md]
- Operations must support budget control and rollback. [VERIFIED: CLAUDE.md]
- Before repo edits, use GSD workflow unless explicitly bypassed. [VERIFIED: CLAUDE.md]
- Follow TDD for logic changes: failing test, implementation, green, refactor. [VERIFIED: CLAUDE.md]

## Standard Stack

### Core

| Library / Runtime                                             | Version                                    | Purpose                                                     | Why Standard                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js built-ins (`fs`, `path`, `crypto`, `os`, `node:test`) | Local: v26.1.0                             | Runtime scripts, JSONL file IO, deterministic tests         | Existing code uses CommonJS Node built-ins and `node --test`; no package install is needed for Phase 05. [VERIFIED: codebase]                                   |
| CommonJS hook scripts                                         | Existing project pattern                   | Hook execution and local CLI commands                       | Existing `.claude/hooks/*.js` and `.claude/advisor-mode/*.js` are CommonJS modules with exported pure functions and CLI `main()` wrappers. [VERIFIED: codebase] |
| Claude Code project settings                                  | Current docs URL checked but fetch blocked | Hook registration and project-scoped command/runtime wiring | Existing `.claude/settings.json` registers `PreToolUse`, `PostToolUse`, `Stop`, and `SessionStart` hooks with project-local commands. [VERIFIED: codebase]      |
| JSONL files                                                   | Existing project pattern                   | Append-only operator audit stream                           | Existing code appends JSONL events to runtime `audit/events.jsonl`; Phase 05 should standardize this rather than replace it. [VERIFIED: codebase]               |

### Supporting

| Library / Runtime                             | Version  | Purpose                                              | When to Use                                                                                                                    |
| --------------------------------------------- | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Existing `runtime-paths.js`                   | Existing | Runtime root resolution                              | Use for all audit/state/budget artifacts so tests and operators can override `ADVISOR_MODE_RUNTIME_ROOT`. [VERIFIED: codebase] |
| Existing provider routing/conformance modules | Existing | Doctor checks for route config and conformance state | Use `validateRouteConfig`, route examples, and conformance artifacts for SETP-02 doctor validation. [VERIFIED: codebase]       |
| Existing final-review module                  | Existing | Audit executor decisions and verification evidence   | Reuse existing artifact shapes and `correlationKey` semantics for AUDT-01/AUDT-03. [VERIFIED: codebase]                        |

### Alternatives Considered

| Instead of              | Could Use                    | Tradeoff                                                                                                                                                             |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSONL audit             | SQLite                       | SQLite improves querying but adds schema migration and operational weight; MVP already has append-only JSONL. [VERIFIED: codebase]                                   |
| Local budget state JSON | Gateway-only budget controls | Gateway budgets are useful but cannot enforce all local hook decisions or latency before hook continuation. [ASSUMED]                                                |
| Node built-ins          | Pino / external logger       | Pino was recommended earlier, but Phase 05 can satisfy MVP without installing packages by centralizing existing `appendFileSync` JSONL writes. [VERIFIED: CLAUDE.md] |
| Doctor command only     | Full dashboard               | Requirement asks for doctor/validation command, not UI dashboard. [VERIFIED: .planning/REQUIREMENTS.md]                                                              |

**Installation:**

```bash
# No external packages required for Phase 05 MVP.
```

**Version verification:**

```bash
node --version  # local: v26.1.0
npm --version   # local: 10.33.0
git --version   # local: 2.54.0
```

## Package Legitimacy Audit

Phase 05 MVP should install no external packages. [VERIFIED: codebase]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition                |
| ------- | -------- | --- | --------- | ----------- | --------- | -------------------------- |
| none    | n/a      | n/a | n/a       | n/a         | n/a       | No package install planned |

**Packages removed due to slopcheck [SLOP] verdict:** none.  
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
Claude Code hook event / operator command
        |
        v
[Hook ingress normalizer]
        | adds/derives correlationKey, sessionId, taskId
        v
[Mode + budget evaluator]
        |-- advisor_mode=false ---------> allow/no-op + audit warning/disabled event
        |-- advisor_mode_strict=false --> advisory output + audit warning-only event
        |-- budget exceeded ------------> block/deny + audit budget.exceeded event
        v
[Existing gate/provider/final-review logic]
        | produces consultation / verdict / route / evidence / decision artifacts
        v
[Central audit writer]
        | append-only JSONL, sanitized, one event per line
        v
.advisor/audit/events.jsonl or runtimePath(root, ['audit','events.jsonl'])
        |
        v
advisor-mode audit/doctor CLI -> filter by correlationKey/sessionId/taskId -> operator report
```

### Recommended Project Structure

```text
.claude/
├── advisor-mode/
│   ├── audit-log.js              # append-only event writer, reader/filter helpers
│   ├── budget-state.js           # per-task/session counters, limit evaluation
│   ├── doctor.js                 # operator validation command for SETP-02
│   ├── rollback.md               # kill switch / warning-only / restore path
│   ├── policy.example.json       # add budget defaults and audit field docs
│   └── tests/
│       ├── audit-log.test.js
│       ├── budget-state.test.js
│       ├── doctor.test.js
│       └── rollback.test.js
└── hooks/
    ├── advisor-gate.js           # integrate budget + audit writer
    ├── advisor-final-review-gate.js # integrate mode audit and budget where advisor calls apply
    └── executor-route-audit.js   # route audit should use shared writer
```

### Pattern 1: Shared Append-Only Audit Writer

**What:** Replace scattered direct `fs.appendFileSync(...events.jsonl...)` calls with one `appendAuditEvent(event, options)` helper that adds `timestamp`, `event`, `correlationKey`, optional `sessionId`, optional `taskId`, and rejects or strips sensitive fields. [VERIFIED: codebase]

**When to use:** Every hook decision, provider route resolution, conformance result, advisor verdict, executor follow-up decision, verification evidence, budget decision, and doctor/rollback state check should append through this helper. [VERIFIED: codebase]

**Example:**

```js
// Source: existing final-review.js/provider-routing.js patterns [VERIFIED: codebase]
appendAuditEvent(
  {
    event: "budget.exceeded",
    correlationKey,
    sessionId,
    taskId,
    limitType: "advisorCalls",
    limit: 3,
    current: 4,
    gateAction: "block",
  },
  { root },
);
```

### Pattern 2: Budget Evaluation Before Advisor Escalation

**What:** Evaluate budget before writing/allowing a new advisor consultation request; increment counters only when an advisor consultation is required or verdict is recorded. [ASSUMED]

**When to use:** In `advisor-gate.js` before `writeConsultationRequest`, in final review paths before requiring a fresh final advisor verdict, and in any future advisor-producing command. [VERIFIED: codebase]

**Example:**

```js
// Source: existing evaluateGatePolicy strict/advisory split [VERIFIED: codebase]
const budget = evaluateBudget(
  { correlationKey, sessionId, taskId, eventType: "advisor_call" },
  { root },
);
if (!budget.ok) {
  appendAuditEvent({ event: "budget.exceeded", ...budget.audit }, { root });
  return strictMode
    ? hardStop("advisor-budget-exceeded", budget.message)
    : advisoryOnlyResult(
        base,
        "Advisor budget exceeded; warning-only mode continues.",
      );
}
```

### Pattern 3: Doctor as Read-Only Validator

**What:** `doctor.js` should inspect files and current config, run deterministic validations, and print machine-readable JSON plus human summary. [ASSUMED]

**When to use:** Operator runs before enabling strict enforcement, after rollback, or after editing hooks/routes/policy. [ASSUMED]

**Checks to include:** `.claude/settings.json` hook registration, `advisor-reviewer` read-only tools, `policy.example.json` parse/schema expectations, provider routes validation, conformance state existence/status, runtime audit/state dir writeability, budget policy parse, and kill-switch mode. [VERIFIED: codebase]

### Anti-Patterns to Avoid

- **Counting only successful advisor verdicts:** Budget limits must account for attempted advisor calls/consultations, because failed or blocked attempts still consume operator time and can loop. [ASSUMED]
- **Inventing runtime provider identity:** Phase 04 concluded only runtime `response.body.model` is confirmed for observed model; keep configured provider/model separate from observed model. [VERIFIED: .planning/phases/04-provider-routing-and-conformance/04-VERIFICATION.md]
- **Relying on non-append rewrites for audit:** Rewriting audit history conflicts with AUDT-01 append-only inspection. [VERIFIED: .planning/REQUIREMENTS.md]
- **Making rollback mutate secrets or external provider config:** Rollback should toggle local enforcement/config and document operator-owned env cleanup, not edit credential values. [VERIFIED: codebase]
- **Adding a hosted service/dashboard:** Phase 05 requirements are local audit, budget, rollback, and doctor; hosted UI is out of scope. [VERIFIED: .planning/REQUIREMENTS.md]

## Don't Hand-Roll

| Problem                 | Don't Build                         | Use Instead                                                   | Why                                                                                                      |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Runtime path scoping    | New ad-hoc `.advisor` path resolver | Existing `runtime-paths.js`                                   | Existing code hashes project root and supports `ADVISOR_MODE_RUNTIME_ROOT`. [VERIFIED: codebase]         |
| JSON parsing validation | Large custom framework              | Small existing CommonJS validators/tests                      | Existing modules already use explicit validators and `node:test`. [VERIFIED: codebase]                   |
| Provider live checks    | New gateway client for doctor       | Existing `provider-conformance.js` artifacts/CLI              | Phase 04 already created live/mock conformance checks and audit artifacts. [VERIFIED: codebase]          |
| Route inspection        | Static inference from aliases only  | Existing `provider-routing.js` configured-vs-observed helpers | Phase 04 intentionally separates configured route data from observed runtime model. [VERIFIED: codebase] |
| Enforcement mode        | New config source                   | `.planning/config.json` hooks flags                           | Existing gates already read `advisor_mode` and `advisor_mode_strict`. [VERIFIED: codebase]               |

**Key insight:** Phase 05 is operational hardening of existing local artifacts, not a new orchestration layer. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Audit Events Without Correlation Fields

**What goes wrong:** The operator can see events but cannot reconstruct a task/session timeline. [ASSUMED]  
**Why it happens:** Existing events are inconsistent: some include only `correlationKey`, and Phase 05 adds task/session scope later. [VERIFIED: codebase]  
**How to avoid:** Centralize audit writing and require `correlationKey`; include `sessionId` and `taskId` whenever available. [ASSUMED]  
**Warning signs:** Tests accept audit events without any correlation field. [ASSUMED]

### Pitfall 2: Budget State Double-Counts Retries

**What goes wrong:** Explicit retry after a blocked gate may consume budget twice even though no new advisor consultation occurred. [ASSUMED]  
**Why it happens:** Existing gate flow requires retry after recommendation/disposition artifacts exist. [VERIFIED: codebase]  
**How to avoid:** Count advisor consultation request creation and verdict receipt as separate intentional events; do not count satisfied reentry that reads an existing valid artifact. [ASSUMED]  
**Warning signs:** Tests show budget increments when `workflowGateStatus: 'satisfied'`. [ASSUMED]

### Pitfall 3: Warning-Only Mode Still Blocks

**What goes wrong:** Rollback to advisory-only mode fails because one path still emits `permissionDecision: deny` or exit code 2. [ASSUMED]  
**Why it happens:** Existing code has separate strict/advisory branches and hard-stop branches. [VERIFIED: codebase]  
**How to avoid:** Add rollback tests for `advisor_mode=false`, `advisor_mode=true/advisor_mode_strict=false`, and `advisor_mode=true/advisor_mode_strict=true`. [VERIFIED: codebase]  
**Warning signs:** CLI tests for advisory mode return non-zero for normal policy misses/budget warnings. [ASSUMED]

### Pitfall 4: Doctor Becomes an Installer

**What goes wrong:** Doctor mutates project assets, making validation non-repeatable and surprising. [ASSUMED]  
**Why it happens:** Existing `init.js` is a scaffold command and could be conflated with validation. [VERIFIED: codebase]  
**How to avoid:** Keep `doctor.js` read-only by default; if repair is later added, make it explicit and out of Phase 05 MVP. [ASSUMED]

### Pitfall 5: Token/Cost Claims Exceed Available Runtime Data

**What goes wrong:** Audit claims token or cost precision that provider/runtime metadata does not expose. [ASSUMED]  
**Why it happens:** Phase 04 showed provider/runtime observability is limited and must avoid fabricating fields. [VERIFIED: .planning/phases/04-provider-routing-and-conformance/04-VERIFICATION.md]  
**How to avoid:** Record token/cost fields only when supplied by provider response or conformance/usage metadata; otherwise record `unknown`/`unavailable` with source. [ASSUMED]

## Code Examples

### Append JSONL Event with Existing Runtime Path Pattern

```js
// Source: final-review.js and provider-routing.js use fs.mkdirSync + appendFileSync [VERIFIED: codebase]
function appendAuditEvent(event, options = {}) {
  const root = options.root || process.cwd();
  const auditPath =
    options.auditPath || runtimePath(root, ["audit", "events.jsonl"], options);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(
    auditPath,
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`,
  );
  return { ok: true, path: auditPath };
}
```

### Evaluate Enforcement Mode from Existing Config

```js
// Source: advisor-gate.js and advisor-final-review-gate.js [VERIFIED: codebase]
function readAdvisorHookConfig(rootDir) {
  try {
    const configPath = path.join(rootDir, ".planning", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.hooks || {};
  } catch {
    return {};
  }
}
```

### Doctor Hook Registration Check

```js
// Source: .claude/settings.json current hook structure [VERIFIED: codebase]
function hasHook(settings, eventName, commandPart) {
  return (settings.hooks[eventName] || [])
    .flatMap((entry) => entry.hooks || [])
    .some(
      (hook) =>
        typeof hook.command === "string" && hook.command.includes(commandPart),
    );
}
```

## State of the Art

| Old Approach                                    | Current Approach                                      | When Changed                                                                                 | Impact                                                                                |
| ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Scattered artifact writes                       | Shared audit helper and schema discipline             | Phase 05 planned [ASSUMED]                                                                   | Enables AUDT-01 and AUDT-03 across all events. [ASSUMED]                              |
| Static configured route treated as served route | Runtime `response.body.model` only for observed model | Phase 04 [VERIFIED: .planning/phases/04-provider-routing-and-conformance/04-VERIFICATION.md] | Phase 05 audit must preserve configured-vs-observed distinction. [VERIFIED: codebase] |
| Advisory enforcement toggles undocumented       | Documented kill switch and warning-only rollback      | Phase 05 planned [ASSUMED]                                                                   | Enables SAFE-03. [VERIFIED: .planning/REQUIREMENTS.md]                                |
| Slice-specific tests only                       | Unified doctor command                                | Phase 05 planned [ASSUMED]                                                                   | Enables SETP-02 operator validation. [VERIFIED: .planning/REQUIREMENTS.md]            |

**Deprecated/outdated:**

- Treating `.advisor/audit/events.jsonl` as incidental debug output is no longer enough; Phase 05 must make it the official local audit trail. [VERIFIED: .planning/REQUIREMENTS.md]
- Treating `advisor_mode_strict=false` as equivalent to disabled is inaccurate; disabled means no Advisor Mode enforcement, warning-only means advisory context/audit without blocking. [VERIFIED: codebase]

## Assumptions Log

| #   | Claim                                                                           | Section                     | Risk if Wrong                                                                                                     |
| --- | ------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A1  | Doctor should validate rather than mutate by default.                           | Summary / Pattern 3         | Planner may under-scope repair automation if user expects doctor to fix installs.                                 |
| A2  | Local budget state should enforce before advisor consultation proceeds.         | Pattern 2                   | If runtime only exposes usage after calls, token limits may require post-call accounting plus next-call blocking. |
| A3  | Gateway-only budgets cannot cover all local hook decisions.                     | Standard Stack alternatives | Planner may duplicate controls if gateway budgets are mandatory in deployment.                                    |
| A4  | Audit helper should reject/strip sensitive fields.                              | Pattern 1                   | Security risk if sensitive provider payloads are written to local audit logs.                                     |
| A5  | Count consultation creation/verdict receipt, not satisfied reentry, for budget. | Pitfall 2                   | Incorrect accounting may block valid retries or allow loops.                                                      |

## Open Questions

1. **What exact budget defaults should ship in MVP?**
   - What we know: Requirement allows hard limits for advisor calls, tokens, or latency per task/session. [VERIFIED: .planning/REQUIREMENTS.md]
   - What's unclear: Default numeric limits are not specified. [VERIFIED: codebase]
   - Recommendation: Planner should set conservative example defaults in `policy.example.json` and make tests validate configurability, not a universal hard-coded threshold. [ASSUMED]

2. **Where does `sessionId` come from in real Claude Code hook input?**
   - What we know: Existing code accepts raw hook input and normalizes known fields like `hookEventName`, `toolName`, `toolInput`, and task state. [VERIFIED: codebase]
   - What's unclear: Current code does not show a canonical session identifier field from host input. [VERIFIED: codebase]
   - Recommendation: Accept `sessionId`, `session_id`, env fallback, or generated runtime session state; tag source in audit. [ASSUMED]

3. **Should doctor perform live provider calls?**
   - What we know: Phase 04 live conformance command already exists and requires operator-owned env vars. [VERIFIED: codebase]
   - What's unclear: SETP-02 says verify routes, not necessarily call live provider every doctor run. [VERIFIED: .planning/REQUIREMENTS.md]
   - Recommendation: Default doctor to offline checks plus conformance artifact status; add `--live` or recommend existing conformance command for live verification. [ASSUMED]

## Environment Availability

| Dependency | Required By                                       | Available | Version | Fallback                                                                                             |
| ---------- | ------------------------------------------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------- |
| Node.js    | Hook scripts, tests, doctor CLI                   | ✓         | v26.1.0 | None needed. [VERIFIED: shell]                                                                       |
| npm        | Existing ecosystem checks only                    | ✓         | 10.33.0 | Not required if no installs. [VERIFIED: shell]                                                       |
| git        | Changed-file/fingerprint/operator context if used | ✓         | 2.54.0  | Use hook input only for tests. [VERIFIED: shell]                                                     |
| Python     | Not required by Phase 05 MVP                      | ✓         | 3.12.9  | n/a. [VERIFIED: shell]                                                                               |
| ctx7 CLI   | Documentation lookup                              | ✗         | n/a     | Official docs URLs and codebase evidence; docs fetch was blocked/ctx7 unavailable. [VERIFIED: shell] |

**Missing dependencies with no fallback:** none for implementation. [VERIFIED: shell]  
**Missing dependencies with fallback:** ctx7 unavailable; use codebase-verified patterns and official docs URLs for planner reference. [VERIFIED: shell]

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Node built-in `node:test` on local Node v26.1.0. [VERIFIED: codebase]                                                                                                                                      |
| Config file        | none; tests are direct `.test.js` files under `.claude/advisor-mode/tests/`. [VERIFIED: codebase]                                                                                                          |
| Quick run command  | `node --test .claude/advisor-mode/tests/audit-log.test.js .claude/advisor-mode/tests/budget-state.test.js .claude/advisor-mode/tests/doctor.test.js .claude/advisor-mode/tests/rollback.test.js` [ASSUMED] |
| Full suite command | `node --test .claude/advisor-mode/tests/*.test.js` [VERIFIED: codebase]                                                                                                                                    |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                         | Test Type        | Automated Command                                             | File Exists? |
| ------- | ---------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------- | ------------ |
| AUDT-01 | Appends and reads audit events for advisor triggers, hook decisions, route events, verdicts, executor decisions. | unit/integration | `node --test .claude/advisor-mode/tests/audit-log.test.js`    | ❌ Wave 0    |
| AUDT-03 | Propagates `correlationKey`, `taskId`, and `sessionId` across audit events and filters by them.                  | unit             | `node --test .claude/advisor-mode/tests/audit-log.test.js`    | ❌ Wave 0    |
| SAFE-01 | Blocks or warns when advisor call/token/latency budget is exceeded per task/session.                             | unit/integration | `node --test .claude/advisor-mode/tests/budget-state.test.js` | ❌ Wave 0    |
| SAFE-03 | Disabled and warning-only modes do not hard-block normal advisor gates; strict mode still blocks.                | integration      | `node --test .claude/advisor-mode/tests/rollback.test.js`     | ❌ Wave 0    |
| SETP-02 | Doctor validates hooks, routes, advisor read-only permissions, runtime dirs, budget policy, and rollback mode.   | integration      | `node --test .claude/advisor-mode/tests/doctor.test.js`       | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** run the specific new test file for the task plus any touched existing test file. [ASSUMED]
- **Per wave merge:** `node --test .claude/advisor-mode/tests/*.test.js`. [VERIFIED: codebase]
- **Phase gate:** full suite green before `/gsd:verify-work`. [VERIFIED: CLAUDE.md]

### Wave 0 Gaps

- [ ] `.claude/advisor-mode/tests/audit-log.test.js` — covers AUDT-01, AUDT-03. [ASSUMED]
- [ ] `.claude/advisor-mode/tests/budget-state.test.js` — covers SAFE-01. [ASSUMED]
- [ ] `.claude/advisor-mode/tests/rollback.test.js` — covers SAFE-03. [ASSUMED]
- [ ] `.claude/advisor-mode/tests/doctor.test.js` — covers SETP-02. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category                 | Applies | Standard Control                                                                                                                 |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication             | no      | No user auth surface in local CLI MVP. [VERIFIED: codebase]                                                                      |
| V3 Session Management         | yes     | Treat task/session IDs as correlation metadata, not auth/session secrets. [ASSUMED]                                              |
| V4 Access Control             | yes     | Advisor remains read-only; doctor checks advisor agent tool list excludes mutation/command tools. [VERIFIED: codebase]           |
| V5 Input Validation           | yes     | Validate JSON policy/routes/budget/audit event shapes before use. [VERIFIED: codebase]                                           |
| V6 Cryptography               | yes     | Use Node `crypto` only for deterministic IDs/hashes; do not implement custom cryptography. [VERIFIED: codebase]                  |
| V7 Error Handling and Logging | yes     | Sanitize audit events and avoid headers, bearer tokens, prompts, request bodies, or raw provider responses. [VERIFIED: codebase] |

### Known Threat Patterns for local hook/audit stack

| Pattern                                            | STRIDE                 | Standard Mitigation                                                                                                                                   |
| -------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret leakage into audit JSONL                    | Information Disclosure | Central audit sanitizer rejects `authorization`, `headers`, `requestBody`, `prompt`, `response`, bearer token-like values. [VERIFIED: codebase]       |
| Tampering with audit history                       | Tampering              | Append-only writer, tests that reader tolerates malformed trailing lines but writer never rewrites existing events. [ASSUMED]                         |
| Advisor bypass by config toggle without visibility | Repudiation            | Kill-switch changes should be documented and doctor should report current disabled/warning/strict mode. [ASSUMED]                                     |
| Budget bypass by changing task/session IDs         | Elevation of Privilege | Bind budget accounting to both session/task and `correlationKey`; audit ID source and fallback. [ASSUMED]                                             |
| Fabricated observed provider/model                 | Spoofing               | Preserve Phase 04 rule: runtime observed model only from `response.body.model`; configured provider remains configured metadata. [VERIFIED: codebase] |

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md` — Phase 05 requirement IDs and requirement text. [VERIFIED: codebase]
- `.planning/STATE.md` — current phase status and historical decisions. [VERIFIED: codebase]
- `CLAUDE.md` — project constraints, stack, workflow directives. [VERIFIED: codebase]
- `.claude/advisor-mode/README.md` — existing Phase 1-4 runtime artifacts, route/conformance behavior, audit paths. [VERIFIED: codebase]
- `.claude/settings.json` — current hook registration and timeout patterns. [VERIFIED: codebase]
- `.claude/hooks/advisor-gate.js` — current gate, config, correlation, consultation, human approval, route metadata behavior. [VERIFIED: codebase]
- `.claude/hooks/advisor-final-review-gate.js` — strict/advisory final review mode behavior. [VERIFIED: codebase]
- `.claude/advisor-mode/final-review.js` — executor decision and verification evidence audit writes. [VERIFIED: codebase]
- `.claude/advisor-mode/provider-routing.js` — configured-vs-observed route audit behavior. [VERIFIED: codebase]
- `.planning/phases/04-provider-routing-and-conformance/04-VERIFICATION.md` — Phase 04 verified route observability semantics. [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

- [Claude Code hooks docs](https://docs.anthropic.com/en/docs/claude-code/hooks) — official reference URL for hook events/output semantics; fetch was blocked in this environment. [CITED: docs.anthropic.com/en/docs/claude-code/hooks]
- [Claude Code settings docs](https://docs.anthropic.com/en/docs/claude-code/settings) — official reference URL for settings scopes; fetch was blocked in this environment. [CITED: docs.anthropic.com/en/docs/claude-code/settings]
- [Claude Code subagents docs](https://docs.anthropic.com/en/docs/claude-code/sub-agents) — official reference URL for subagent permissions; fetch was blocked in this environment. [CITED: docs.anthropic.com/en/docs/claude-code/sub-agents]
- [Claude Code slash commands docs](https://docs.anthropic.com/en/docs/claude-code/slash-commands) — official reference URL for project-local operator commands; fetch was blocked in this environment. [CITED: docs.anthropic.com/en/docs/claude-code/slash-commands]

### Tertiary (LOW confidence)

- Local operational recommendations about exact budget accounting and doctor default behavior are marked `[ASSUMED]` and need planner/user confirmation if they affect scope. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — Phase 05 can use existing Node/CommonJS/no-install stack verified in the codebase. [VERIFIED: codebase]
- Architecture: HIGH — Existing hooks, runtime paths, audit artifacts, and config flags are present and tested by previous phases. [VERIFIED: codebase]
- Pitfalls: MEDIUM — Pitfalls are derived from existing retry/config behavior plus operational assumptions about budget/audit accounting. [ASSUMED]

**Research date:** 2026-05-29  
**Valid until:** 2026-06-28 for local codebase patterns; re-check Claude Code official docs before changing hook protocol assumptions. [ASSUMED]
