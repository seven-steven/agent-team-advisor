# Architecture Research

**Domain:** Pure client-side advisor-mode orchestration for Claude Code Teams  
**Researched:** 2026-05-19  
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

Pure client-side Advisor Mode should be structured as a local orchestration layer around Claude Code / Claude Code Teams, not as a model-side or server-side tool. The executor remains the only actor allowed to mutate the workspace. The advisor is a stronger, read-only teammate/subagent invoked by policy, hooks, or explicit escalation.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Claude Code Runtime                          │
│                                                                     │
│  ┌──────────────────┐      ┌──────────────────────────────┐        │
│  │ User / Operator  │─────▶│ Executor Agent / Team Lead    │        │
│  └──────────────────┘      │ - main task loop              │        │
│                            │ - tool use                    │        │
│                            │ - final decisions             │        │
│                            └──────────────┬───────────────┘        │
│                                           │                         │
│                                           │ Agent / SendMessage     │
│                                           ▼                         │
│                            ┌──────────────────────────────┐        │
│                            │ Advisor Agent / Teammate      │        │
│                            │ - read-only review            │        │
│                            │ - risk assessment             │        │
│                            │ - validation checklist        │        │
│                            └──────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                    │                       ▲
                    │ hook inputs / events  │ structured findings
                    ▼                       │
┌─────────────────────────────────────────────────────────────────────┐
│                      Local Policy & Control Layer                    │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Trigger Policy   │  │ Hook Scripts     │  │ Prompt Contracts │ │
│  │ - risk rules     │  │ - PreToolUse     │  │ - executor rules │ │
│  │ - retry rules    │  │ - PostToolUse    │  │ - advisor format │ │
│  │ - final review   │  │ - Stop/Subagent  │  │ - no-write role  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Audit Logger     │  │ Budget Guard     │  │ Rollback Config  │ │
│  │ - decisions      │  │ - token limits   │  │ - disable hooks  │ │
│  │ - trigger reason │  │ - latency caps   │  │ - route fallback │ │
│  │ - model route    │  │ - advisor quota  │  │ - safe defaults  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    │ Anthropic-compatible requests
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Anthropic-Compatible Provider                     │
│                                                                     │
│  ┌────────────────────────┐     ┌──────────────────────────────┐   │
│  │ Claude Alias Interface │────▶│ Model Router / Gateway        │   │
│  │ - sonnet alias         │     │ - sonnet → executor model     │   │
│  │ - opus alias           │     │ - opus → advisor model        │   │
│  │ - haiku alias          │     │ - fallback / budget policy    │   │
│  └────────────────────────┘     └──────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────┐     ┌──────────────────────────────┐   │
│  │ Provider Observability │     │ Real Model Providers          │   │
│  │ - tokens               │     │ - GLM executor target         │   │
│  │ - latency              │     │ - GPT-5.5 advisor target      │   │
│  │ - spend                │     │ - DeepSeek/Qwen/etc. later    │   │
│  └────────────────────────┘     └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component                  | Responsibility                                                                                                            | Boundary                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Executor Agent / Team Lead | Owns the task loop, tool calls, edits, test execution, git operations, and final decisions                                | May call advisor; may mutate workspace; must record decisions                 |
| Advisor Agent / Teammate   | Provides read-only risk analysis, diagnosis, review, and validation checklists                                            | Must not edit files, run destructive tools, or make final execution decisions |
| Trigger Policy             | Defines when advisor consultation is required                                                                             | Pure local rules; should not depend on model goodwill alone                   |
| Hook Scripts               | Enforce policy at Claude Code lifecycle boundaries such as `PreToolUse`, `PostToolUse`, `Stop`, and subagent completion   | Should be deterministic, fast, auditable, and fail-safe                       |
| Prompt Contracts           | Encode role separation and structured response schemas                                                                    | Should be versioned project assets, not ad hoc prompts                        |
| Audit Logger               | Records trigger reason, request context, advisor response, executor decision, model route, token usage, latency, and cost | Append-only local artifacts; no hidden state                                  |
| Budget Guard               | Caps advisor frequency, token budget, latency, and retry escalation                                                       | Must be enforced outside the advisor prompt                                   |
| Provider Router            | Maps Claude model aliases to third-party models while preserving Claude Code semantics                                    | External to Claude Code runtime but local/user-controlled                     |
| Rollback Config            | Allows disabling advisor enforcement, switching routes, or reverting to direct Claude model use                           | Must be simple enough for incident recovery                                   |

## Recommended Project Structure

```
.claude/
├── agents/
│   ├── advisor.md              # Read-only advisor role, model, tools, output schema
│   └── executor-policy.md      # Optional executor/team-lead operating policy
├── hooks/
│   ├── pre-tool-risk-gate.*    # Blocks or flags high-risk tool calls
│   ├── post-tool-audit.*       # Logs tool outcomes and failure signals
│   ├── stop-final-review.*     # Requires final advisor review before completion
│   └── shared/
│       ├── classify-risk.*     # Shared risk classification helper
│       ├── budget.*            # Shared budget/quota helper
│       └── audit.*             # Shared audit writer
├── settings.json              # Hooks, env, permissions, provider env vars
└── advisor-mode/
    ├── trigger-policy.json     # Risk, retry, uncertainty, and final-review rules
    ├── routing-policy.json     # Alias expectations and provider route labels
    ├── budget-policy.json      # Max consultations, token caps, latency caps
    └── schemas/
        ├── advisor-report.json # Structured advisor output contract
        └── audit-event.json    # Audit event schema

planning-or-runtime-artifacts/
└── advisor-audit/
    ├── sessions/
    │   └── <session-id>.jsonl  # Local append-only consultation/audit stream
    └── summaries/
        └── <date>.md           # Optional human-readable rollups
```

### Structure Rationale

- **`.claude/agents/`:** Keep role definitions close to Claude Code’s native subagent model. Advisor should be a custom subagent/teammate with read-only tools and a stronger model alias.
- **`.claude/hooks/`:** Hooks are the enforcement boundary. They convert “executor should ask advisor” into auditable local policy.
- **`.claude/advisor-mode/`:** Policy should be data-driven so trigger thresholds, budgets, and routing labels can evolve without rewriting every hook.
- **`advisor-audit/`:** Advisor Mode needs durable records because the product value depends on reliability, reviewability, budget control, and rollback.

## Architectural Patterns

### Pattern 1: Executor-Owned Mutation, Advisor-Owned Judgment

**What:** The executor performs all workspace mutation. The advisor receives context and returns structured analysis only.

**When to use:** Always. This is the core safety boundary for pure client-side advisor mode.

**Trade-offs:**

- Pros: Clear accountability, lower risk of conflicting edits, easier audit trail.
- Cons: Executor can ignore weakly enforced advice unless hooks/policy require acknowledgment.

**Recommended contract:**

```text
Advisor returns:
- risk_level: low | medium | high | critical
- blocking_findings: list
- recommended_next_step: list
- validation_checklist: list
- confidence: low | medium | high

Advisor must not:
- edit files
- run commands
- approve its own changes
- make final delivery claims
```

### Pattern 2: Hook-Enforced Escalation

**What:** Local hooks inspect tool calls, failures, and completion attempts. When risk conditions match, the executor must consult the advisor before proceeding.

**When to use:** For high-risk Bash commands, destructive file operations, repeated failures, security-sensitive changes, dependency upgrades, schema migrations, auth changes, and final task completion.

**Trade-offs:**

- Pros: Reliable enforcement independent of executor self-discipline.
- Cons: Hooks cannot fully understand intent unless they receive enough context; overly broad hooks can slow workflow.

**Typical trigger classes:**

| Trigger                          | Event Source                    | Required Action                              |
| -------------------------------- | ------------------------------- | -------------------------------------------- |
| High-risk tool call              | `PreToolUse`                    | Consult advisor or require explicit override |
| Repeated failed command/test     | `PostToolUse`                   | Escalate diagnosis to advisor                |
| Large edit or broad file surface | `PostToolUse` / transcript scan | Request risk review                          |
| Final answer attempt             | `Stop`                          | Require advisor validation checklist         |
| Subagent completion              | `SubagentStop`                  | Optionally review subordinate findings       |

### Pattern 3: Alias-Based Model Routing

**What:** Claude Code continues to request Claude-style aliases, while the Anthropic-compatible provider routes aliases to actual third-party models.

**When to use:** Required for the project goal of using cheaper/faster executor models and stronger advisor models without relying on server-side advisor tooling.

**Recommended mapping:**

| Claude Alias | Role               | Initial Route                                         |
| ------------ | ------------------ | ----------------------------------------------------- |
| sonnet       | Executor           | GLM or equivalent fast/cost-effective coding model    |
| opus         | Advisor            | GPT-5.5 or strongest available review/diagnosis model |
| haiku        | Lightweight helper | Optional cheap classifier/summarizer                  |

**Trade-offs:**

- Pros: Keeps Claude Code configuration simple and uses model semantics already understood by Claude Code.
- Cons: Requires careful observability because “opus” in Claude Code may not mean Anthropic Opus behind the gateway.

### Pattern 4: Structured Advisor Reports

**What:** Advisor responses should be machine-parseable enough for hooks and executor policy to consume.

**When to use:** Always for enforced reviews, failure diagnosis, and final acceptance.

**Minimum fields:**

```json
{
  "trigger_reason": "string",
  "risk_level": "low|medium|high|critical",
  "confidence": "low|medium|high",
  "blocking_findings": [],
  "recommended_actions": [],
  "validation_checklist": [],
  "can_proceed": true
}
```

**Trade-offs:**

- Pros: Enables automated gates, audit summaries, and roadmap-quality verification.
- Cons: Strict schemas can reduce nuance; allow a short free-text rationale field.

### Pattern 5: Append-Only Local Audit Stream

**What:** Every consultation and policy-relevant event is appended to a local JSONL audit log.

**When to use:** From phase one. Retrofitting audit later is painful because early behavior will be unmeasurable.

**Event examples:**

- `advisor_triggered`
- `advisor_skipped_with_reason`
- `advisor_response_received`
- `executor_decision_after_advice`
- `budget_limit_hit`
- `route_selected`
- `final_review_completed`

## Data Flow

### Normal Execution Flow

```
User task
  ↓
Executor / Team Lead loads project context
  ↓
Executor plans and starts tool-driven implementation
  ↓
PreToolUse hook evaluates tool risk
  ↓
Low-risk path:
  tool executes
  ↓
PostToolUse hook logs result
  ↓
Executor continues
```

### Advisor Escalation Flow

```
Executor action or state
  ↓
Hook or prompt policy detects trigger
  ↓
Trigger reason + minimal relevant context assembled
  ↓
Advisor teammate/subagent invoked through Agent or SendMessage
  ↓
Advisor reads context with read-only tools
  ↓
Advisor returns structured risk report
  ↓
Audit logger records:
  - trigger reason
  - model alias and routed provider label
  - token/latency/cost if available
  - advisor recommendation
  ↓
Executor decides and acts
  ↓
Audit logger records executor decision
```

### Failure Diagnosis Flow

```
Tool/test failure
  ↓
PostToolUse hook records failure
  ↓
Failure counter updates for session/task
  ↓
Threshold crossed
  ↓
Advisor receives:
  - task goal
  - failed command summary
  - relevant error excerpts
  - changed file list
  - prior attempted fixes
  ↓
Advisor returns diagnosis and verification plan
  ↓
Executor implements or asks user if scope changes
```

### Final Acceptance Flow

```
Executor believes task is complete
  ↓
Stop hook or executor policy triggers final review
  ↓
Advisor receives:
  - original request
  - changed files
  - verification commands and results
  - known limitations
  ↓
Advisor returns:
  - blocking findings
  - residual risks
  - recommended final checks
  - can_proceed flag
  ↓
Executor either:
  - fixes blockers and re-verifies
  - reports concerns
  - completes final response
```

### Provider Routing Flow

```
Claude Code model request
  ↓
ANTHROPIC_BASE_URL / compatible gateway
  ↓
Alias/model name observed by provider
  ↓
Routing policy maps alias:
  - sonnet → executor model
  - opus → advisor model
  - haiku → optional helper
  ↓
Provider calls real model
  ↓
Provider records usage metadata
  ↓
Response streams back to Claude Code
```

## Component Boundaries

| Boundary                      | Communication                                                | Notes                                                                            |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| User ↔ Executor               | Natural language task prompt                                 | User should not need to manually choose advisor moments                          |
| Executor ↔ Advisor            | Agent tool, Teams teammate messaging, or SendMessage         | Advisor receives scoped context, not full uncontrolled transcript when avoidable |
| Hooks ↔ Executor              | Claude Code hook event JSON and exit behavior                | Hooks enforce policy but should stay deterministic                               |
| Hooks ↔ Audit Store           | Append-only local JSONL writes                               | Avoid hidden mutable state except counters/budget files                          |
| Executor ↔ Provider           | Claude Code model requests via Anthropic-compatible endpoint | Executor should not know real provider credentials                               |
| Provider ↔ Real Models        | Gateway-specific routing                                     | Route labels and costs must be observable                                        |
| Budget Guard ↔ Hooks/Provider | Local policy plus provider usage metadata                    | Enforce local caps even if provider budget features exist                        |
| Advisor ↔ Workspace           | Read-only tools only                                         | This is the critical safety boundary                                             |

## Suggested Build Order

### Phase 1: Static Advisor Contract and Manual Invocation

Build first:

1. Advisor agent definition with read-only tools.
2. Executor prompt policy explaining when to consult advisor.
3. Structured advisor report schema.
4. Minimal manual invocation workflow.

Why first:

- Establishes the core role boundary.
- Validates whether advisor output is useful before enforcing it.
- Requires no complex hooks or provider observability.

### Phase 2: Local Audit and Trigger Policy

Build next:

1. `trigger-policy.json`.
2. Append-only audit event schema.
3. Audit writer helper.
4. Manual/advisory logging around consultations.

Why next:

- Enforcement without audit is hard to debug.
- Audit format should stabilize before hooks emit many events.

### Phase 3: Hook-Based Risk Gates

Build after policy and audit:

1. `PreToolUse` high-risk command/edit gate.
2. `PostToolUse` failure counter and escalation trigger.
3. `Stop` final-review requirement.
4. Safe override path with logged reason.

Why third:

- Hooks are brittle if introduced before the policy is explicit.
- Early hook enforcement should focus on a small set of high-value gates.

### Phase 4: Provider Alias Routing and Observability

Build after local behavior works:

1. Configure Anthropic-compatible gateway.
2. Route sonnet alias to executor model.
3. Route opus alias to advisor model.
4. Record model route, latency, token usage, and spend.
5. Add rollback route to direct/known-good model.

Why fourth:

- Provider routing multiplies variables. Validate orchestration semantics before changing model backends.
- Observability is required before cost/latency optimization.

### Phase 5: Budget Guardrails and Rollback

Build after real usage data:

1. Advisor consultation quota.
2. Token and latency caps.
3. Escalation priority levels.
4. Emergency disable switch.
5. Route fallback policy.

Why fifth:

- Budgets should be calibrated from observed consultation frequency.
- Rollback is mandatory before broader adoption.

### Phase 6: Team Patterns and Parallel Review

Build last:

1. Multiple specialized advisors if needed.
2. Debate/consensus workflows for ambiguous failures.
3. Background advisor review.
4. Shared task-list conventions.

Why last:

- Teams add coordination complexity.
- Single advisor mode should be reliable before multi-advisor orchestration.

## Scaling Considerations

| Scale                    | Architecture Adjustments                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Single developer / pilot | Local files, one advisor, simple hooks, manual override acceptable                                                       |
| Small team               | Shared `.claude` assets, consistent audit schema, provider route labels, budget defaults                                 |
| Larger team              | Centralized gateway policy, stronger spend tracking, standardized project templates, CI-style validation of hook scripts |
| Enterprise-style use     | Managed provider gateway, formal logs, policy versioning, security review, explicit data retention controls              |

### Scaling Priorities

1. **First bottleneck: false-positive advisor triggers.**  
   Fix with narrower trigger policy, severity levels, and logged override reasons.

2. **Second bottleneck: advisor cost and latency.**  
   Fix with budget caps, smaller context packets, and cheaper classifier/helper model for low-risk triage.

3. **Third bottleneck: audit noise.**  
   Fix with event schemas, summary generation, and clear correlation IDs per task/session.

4. **Fourth bottleneck: model-route ambiguity.**  
   Fix with provider-side route labels and local logging of expected alias-to-real-model mapping.

## Anti-Patterns

### Anti-Pattern 1: Advisor Can Edit Code

**What people do:** Give advisor `Edit`, `Write`, or broad `Bash` permissions.

**Why it's wrong:** It destroys the executor/advisor accountability boundary. Conflicting edits become hard to audit, and the stronger model can make unreviewed changes.

**Do this instead:** Advisor gets read-only tools and returns a structured report. Executor performs all changes.

### Anti-Pattern 2: Prompt-Only Enforcement

**What people do:** Tell the executor “ask the advisor when needed” and rely on compliance.

**Why it's wrong:** The exact moments requiring advice are high-risk, high-pressure, or failure-heavy moments when weak models are most likely to skip process.

**Do this instead:** Use hooks for high-risk tools, repeated failures, and final review.

### Anti-Pattern 3: No Route Observability

**What people do:** Configure `sonnet` and `opus` aliases through a gateway without recording the actual backend model.

**Why it's wrong:** Failures, costs, and quality cannot be attributed. “Advisor worked badly” may actually mean the wrong model was routed.

**Do this instead:** Log expected alias, actual provider route label, token usage, latency, and cost where available.

### Anti-Pattern 4: Full Transcript Dumping

**What people do:** Send the entire session transcript to the advisor for every consultation.

**Why it's wrong:** It increases cost, latency, privacy exposure, and distraction.

**Do this instead:** Send scoped context packets: task goal, trigger reason, changed files, relevant excerpts, failed commands, and verification state.

### Anti-Pattern 5: Enforcing Final Review Before Basic Workflow Works

**What people do:** Add strict `Stop` gates immediately.

**Why it's wrong:** Early false positives and schema churn make the system frustrating and easy to disable.

**Do this instead:** Start with advisory/manual final reviews, then enforce once report schema and audit flow stabilize.

## Integration Points

### External Services

| Service                                            | Integration Pattern                                             | Notes                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Claude Code / Claude Code Teams                    | Native runtime, custom agents, hooks, Agent/SendMessage         | Teams are the orchestration substrate; experimental Teams features should be isolated behind config |
| Anthropic-compatible gateway / LiteLLM-style proxy | `ANTHROPIC_BASE_URL` and auth token route Claude-style requests | Use aliases/model groups and provider logs for observability                                        |
| Real executor model provider                       | Routed behind sonnet alias                                      | Optimize for cost, speed, and tool-use competence                                                   |
| Real advisor model provider                        | Routed behind opus alias                                        | Optimize for reasoning, diagnosis, and review quality                                               |
| Local filesystem                                   | Agent definitions, hooks, policy files, audit logs              | Keep portable and inspectable                                                                       |

### Internal Boundaries

| Boundary                              | Communication                         | Notes                                             |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| Trigger policy ↔ hook scripts         | JSON config read by hooks             | Keeps enforcement rules editable and testable     |
| Hook scripts ↔ audit logger           | Function/module call or CLI helper    | Centralize audit formatting                       |
| Executor prompt ↔ advisor schema      | Explicit structured report contract   | Avoid free-form advice that cannot gate decisions |
| Budget guard ↔ provider observability | Local counters plus provider metadata | Do not rely only on provider-side controls        |
| Rollback config ↔ settings/hooks      | Disable switches and route fallback   | Must be documented before strict enforcement      |

## Confidence Assessment

| Area                                 | Confidence  | Notes                                                                                                                                            |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code subagents                | HIGH        | Verified via Context7-sourced Claude Code docs: subagents support custom definitions, tool restrictions, model selection, and Agent invocation   |
| Claude Code hooks                    | HIGH        | Verified via Context7-sourced Claude Code docs: hooks receive event JSON for tool/session lifecycle events and can be configured in settings     |
| Claude Code Teams / SendMessage      | MEDIUM      | Verified via Context7-sourced Claude Code docs, but Teams are experimental and should be treated as evolving                                     |
| Anthropic-compatible gateway routing | MEDIUM-HIGH | Verified via Claude Code gateway docs snippets and LiteLLM docs for Anthropic-compatible proxying, aliases, routing, budgets, and spend tracking |
| End-to-end Advisor Mode pattern      | MEDIUM      | Architecture is a synthesis; no official pure client-side advisor-mode reference architecture was found                                          |

## Sources

- Context7: Claude Code docs, `/websites/code_claude`, topics: `subagents`, `hooks`, `agent-teams`, `llm-gateway`, `settings`
- Context7: LiteLLM docs, `/websites/litellm_ai`, topics: Anthropic proxy, model aliases, load balancing, fallbacks, cost tracking
- Project context: `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/PROJECT.md`

---

_Architecture research for: Pure client-side advisor-mode systems for Claude Code Teams_  
_Researched: 2026-05-19_
