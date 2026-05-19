# Stack Research

**Domain:** Pure client-side advisor-mode workflow for Claude Code Teams using Anthropic-compatible routing to third-party models  
**Researched:** 2026-05-19  
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology                             | Version                                                         | Purpose                                                     | Why Recommended                                                                                                                                                                                                                                                             | Confidence  |
| -------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Claude Code / Claude Code Teams        | Current CLI, docs reference v2.x era capabilities               | Primary client-side orchestrator                            | Claude Code already provides the primitives this product needs: subagents, hooks, project-local settings, model aliases, permissions, and lifecycle interception. Use it as the orchestration substrate instead of rebuilding an agent loop.                                | HIGH        |
| Project-local Claude Code assets       | `.claude/agents/`, `.claude/settings.json`, `.claude/commands/` | Workflow distribution format                                | Advisor Mode should ship as Claude Code-native project assets: advisor subagent definitions, hook scripts, slash commands, and settings. This keeps setup inspectable, versionable, and reversible.                                                                         | HIGH        |
| Anthropic-compatible provider endpoint | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`                   | Route Claude Code requests to third-party models            | Official Claude Code gateway docs support pointing Claude Code at LLM gateways with `ANTHROPIC_BASE_URL`; OpenRouter also documents direct Anthropic Messages API compatibility. This is the cleanest way to preserve Claude Code semantics while using third-party models. | HIGH        |
| OpenRouter Anthropic-compatible API    | Current                                                         | Default managed gateway for third-party model routing       | For a greenfield client-side workflow, OpenRouter is the most convenient managed option because it exposes an Anthropic-compatible endpoint directly usable by Claude Code: `ANTHROPIC_BASE_URL=https://openrouter.ai/api`. Use this first for low-ops validation.          | MEDIUM-HIGH |
| LiteLLM Proxy                          | 1.85.0                                                          | Self-hosted gateway / policy layer                          | Use LiteLLM when you need stronger routing policy, virtual keys, budgets, aliases, fallbacks, self-hosted audit boundaries, or provider abstraction beyond OpenRouter. LiteLLM supports Anthropic SDK-compatible calls through proxy endpoints and virtual keys.            | HIGH        |
| TypeScript                             | 6.0.3                                                           | Hook scripts, policy engine, config tooling                 | TypeScript is the right implementation language for Claude Code-adjacent tooling because Claude Code and Anthropic SDK examples are TypeScript-friendly, scripts can run locally, schemas can be typed, and npm packaging is straightforward.                               | HIGH        |
| Node.js                                | 24 LTS target, Node 22 minimum                                  | Runtime for hooks and local CLI scripts                     | Use Node for portable local execution. Avoid Python for hook logic unless LiteLLM self-hosting requires it; keeping policy/hook logic in one TS runtime reduces operational friction.                                                                                       | MEDIUM      |
| `@anthropic-ai/claude-agent-sdk`       | 0.3.144                                                         | Optional programmatic orchestration tests and harnesses     | Use only for test harnesses or scripted verification of subagent behavior. Do not make it the core runtime if the product is meant to run inside Claude Code Teams via project assets.                                                                                      | MEDIUM-HIGH |
| `@anthropic-ai/sdk`                    | 0.97.0                                                          | Compatibility test client for Anthropic-compatible gateways | Use it to smoke-test provider compatibility, streaming, tool-use behavior, and alias routing outside Claude Code. It supports custom `base_url` style usage through provider/gateway patterns and current Messages API types.                                               | HIGH        |

### Supporting Libraries

| Library          | Version          | Purpose                                                             | When to Use                                                                                                                                                                                                                                                   | Confidence  |
| ---------------- | ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Zod              | 4.4.3            | Schema validation for advisor outputs, hook configs, route policies | Use for all structured advisor contracts: risk reports, escalation decisions, final-review checklists, budget policy, and provider routing config. Zod 4 has first-party JSON Schema conversion via `z.toJSONSchema()`, useful for prompt contracts and docs. | HIGH        |
| `yaml`           | 2.9.0            | Read/write Claude Code agent frontmatter and LiteLLM config         | Use for generating `.claude/agents/*.md`, validating frontmatter, and optionally producing LiteLLM `config.yaml`.                                                                                                                                             | HIGH        |
| Commander        | 14.0.3           | Local setup/doctor CLI                                              | Use for `advisor-mode init`, `advisor-mode doctor`, `advisor-mode validate`, and `advisor-mode rollback`. Keep it small; do not introduce a full app framework.                                                                                               | HIGH        |
| Pino             | 10.3.1           | Structured local logs                                               | Use for JSONL audit events from hooks: trigger reason, tool name, risk class, model alias, routed provider/model if available, latency, token/cost estimate, and final decision.                                                                              | HIGH        |
| OpenTelemetry JS | 0.218.0 packages | Optional traces/metrics export                                      | Use after MVP when teams need OTLP export. Start with local JSONL first; add OpenTelemetry for enterprise observability or multi-machine aggregation.                                                                                                         | MEDIUM-HIGH |
| Vitest           | 4.1.6            | Unit tests for hook predicates and schema contracts                 | Use for deterministic policy tests: dangerous command detection, repeated-failure escalation, final review required, budget cutoff, malformed advisor output.                                                                                                 | HIGH        |
| tsx              | 4.22.3           | Run TypeScript hooks/dev scripts locally                            | Use for development and project-local hook scripts before packaging compiled JS. For production templates, prefer compiled JS or pinned `npx tsx` instructions.                                                                                               | HIGH        |

### Development Tools

| Tool                             | Purpose                                      | Notes                                                                                                                                                                                                                                    | Confidence  |
| -------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Claude Code hooks                | Enforce advisor consultation gates           | Use `PreToolUse` for high-risk tool calls, `PostToolUse` for failure detection and audit enrichment, `Stop` for final review gating, and `SubagentStop` for advisor output validation. Hooks can use exit-code blocking and JSON output. | HIGH        |
| Claude Code subagents            | Read-only advisor role                       | Define advisor in `.claude/agents/advisor.md` with `tools: Read, Grep, Glob` and `model: opus`. Do not grant `Edit`, `Write`, or `Bash` by default.                                                                                      | HIGH        |
| Claude Code settings             | Project-local env, hooks, permissions        | Prefer project-local `.claude/settings.json` for reproducible team behavior. Use environment variables for secrets only.                                                                                                                 | HIGH        |
| Provider smoke-test script       | Verify Anthropic-compatible gateway behavior | Add a local script that sends Messages API requests through `ANTHROPIC_BASE_URL` using `@anthropic-ai/sdk` and checks model alias resolution, streaming, tool-use compatibility, and error shape.                                        | MEDIUM-HIGH |
| JSONL audit log                  | Minimum viable observability                 | Store local `.advisor/logs/*.jsonl` or equivalent ignored path. Capture escalation reason, hook event, requested alias, actual provider/model when known, latency, cost estimate, and allow/block decision.                              | HIGH        |
| LiteLLM virtual keys and aliases | Budgeted self-host routing                   | Use when running LiteLLM. Virtual keys support alias mapping and can enforce per-team/project budgets.                                                                                                                                   | HIGH        |

## Installation

```bash
# Core local tooling
npm install zod yaml commander pino @anthropic-ai/sdk

# Optional programmatic Claude Code harness
npm install @anthropic-ai/claude-agent-sdk

# Optional observability
npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http

# Dev dependencies
npm install -D typescript tsx vitest @types/node
```

If using LiteLLM as the self-hosted gateway:

```bash
pip install "litellm==1.85.0"
```

OpenRouter managed gateway baseline:

```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""
```

LiteLLM gateway baseline:

```bash
export ANTHROPIC_BASE_URL="https://litellm-server:4000"
export ANTHROPIC_AUTH_TOKEN="sk-litellm-virtual-key"
export ANTHROPIC_API_KEY=""
```

For Anthropic pass-through path when needed:

```bash
export ANTHROPIC_BASE_URL="https://litellm-server:4000/anthropic"
export ANTHROPIC_AUTH_TOKEN="sk-litellm-virtual-key"
```

## Alternatives Considered

| Recommended                      | Alternative                     | When to Use Alternative                                                                                                                                                                      |
| -------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code Teams project assets | Custom standalone orchestrator  | Use a custom orchestrator only if you need to run outside Claude Code entirely. For this project, it would duplicate hooks, permissions, agent lifecycle, and model semantics unnecessarily. |
| OpenRouter first for validation  | LiteLLM first                   | Use LiteLLM first if the team requires self-hosting, strict budget controls, private provider keys, or deterministic routing logs from day one. Otherwise OpenRouter is faster to validate.  |
| LiteLLM for self-hosted gateway  | One-off provider-specific proxy | Use a provider-specific proxy only for a narrow proof of concept. It will create routing drift and make model/provider expansion harder.                                                     |
| TypeScript hook/policy engine    | Bash-only hooks                 | Bash is fine for tiny glue commands, but policy logic needs tests, schemas, structured logs, and maintainability. Use Bash only as a thin launcher.                                          |
| Zod structured contracts         | Free-form advisor text          | Free-form advisor output is hard to gate on. Use Zod-validated JSON sections for risk level, required actions, validation checklist, and stop/continue decision.                             |
| JSONL first, OpenTelemetry later | Full tracing from MVP           | Start with JSONL because local hooks need simple, inspectable audit logs. Add OpenTelemetry once there is a real aggregation requirement.                                                    |

## What NOT to Use

| Avoid                                                                  | Why                                                                                                                                                                           | Use Instead                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Anthropic `server_tool_use` / native advisor-only server-side features | Project requirement is pure client-side Advisor Mode. Third-party providers generally do not expose a protocol-equivalent advisor tool.                                       | Claude Code subagents + hooks + Anthropic-compatible gateway routing.                                                 |
| Advisor with write/execute tools                                       | Violates the read-only advisor boundary and can cause the strong model to directly mutate code or run risky commands.                                                         | `tools: Read, Grep, Glob` for advisor; executor retains `Edit`, `Write`, `Bash`.                                      |
| Prompt-only “remember to ask advisor” policy                           | The executor can forget, skip under pressure, or fail in exactly the scenarios where advisor consultation matters.                                                            | Enforce high-risk, repeated-failure, and final-review gates with hooks.                                               |
| Direct OpenAI-compatible endpoint without Anthropic translation        | Claude Code expects Anthropic Messages semantics, not plain OpenAI Chat Completions. Direct OpenAI-compatible endpoints can break tool/use, streaming, and error assumptions. | OpenRouter Anthropic-compatible endpoint or LiteLLM Anthropic-compatible/proxy endpoint.                              |
| Hard-coded real model names in agent prompts                           | Makes provider swaps and budget routing brittle.                                                                                                                              | Use semantic aliases: `sonnet` for executor, `opus` for advisor, `haiku` for cheap classification/summarization.      |
| Global-only Claude Code configuration                                  | Hard to audit and reproduce across team members.                                                                                                                              | Project-local `.claude/agents/` and `.claude/settings.json`; secrets remain in env.                                   |
| Full MCP server as MVP control plane                                   | Adds unnecessary moving parts for an initial client-side workflow.                                                                                                            | Start with Claude Code-native hooks and local TS scripts. Add MCP later only if tools must be exposed across clients. |
| Heavy database in MVP                                                  | The workflow mainly needs local audit logs and deterministic policy checks.                                                                                                   | JSONL files first; SQLite only if querying/reporting becomes necessary.                                               |
| Unpinned third-party routing behavior                                  | Provider compatibility with Claude Code can drift.                                                                                                                            | Add `advisor-mode doctor` smoke tests and document supported provider/model combinations.                             |

## Stack Patterns by Variant

**If validating quickly with minimal infrastructure:**

- Use Claude Code Teams + project-local `.claude/agents/` + `.claude/settings.json`.
- Use OpenRouter as the Anthropic-compatible gateway.
- Route `sonnet` alias to the executor model and `opus` alias to the advisor model.
- Use TypeScript hooks with Zod validation and JSONL audit logs.
- Because this proves advisor-mode behavior without self-hosting a gateway.

**If building production team rollout:**

- Use Claude Code Teams + LiteLLM Proxy.
- Use LiteLLM virtual keys, aliases, budgets, and fallback routing.
- Keep advisor read-only and enforce gates through hooks.
- Add provider smoke tests in CI/local doctor command.
- Because production rollout needs budget control, auditability, and rollback more than fastest setup.

**If enterprise observability is required:**

- Keep JSONL audit logs as the source of truth.
- Add OpenTelemetry JS exporters for traces/metrics.
- Export hook execution spans, advisor call latency, budget decisions, and final-review gates.
- Because OTel is useful for aggregation, but local JSONL remains easier to debug and replay.

**If provider compatibility is uncertain:**

- Do not enable the model in the default route.
- Add it as an experimental alias behind `advisor-mode doctor`.
- Test non-streaming Messages API, streaming, tool-use compatibility, long context behavior, error shape, and refusal/stop reasons.
- Because “Anthropic-compatible” often means partial compatibility.

## Version Compatibility

| Package / Tool                   | Compatible With                                     | Notes                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code gateway config       | `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`        | `ANTHROPIC_AUTH_TOKEN` is used as bearer auth for gateways. Keep `ANTHROPIC_API_KEY` empty or unset when the gateway expects only its own token.                        |
| Claude Code subagents            | `.claude/agents/*.md`, `~/.claude/agents/*.md`      | Project agents belong in `.claude/agents/`; user agents are global. For Advisor Mode, project-local is preferred for reproducibility.                                   |
| Claude Code subagent model field | `model: sonnet`, `model: opus`, `model: haiku`      | Use semantic aliases so the gateway can route to GLM/GPT/DeepSeek/Qwen/Kimi/etc. without changing agent definitions.                                                    |
| Claude Code hooks                | `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop` | `PreToolUse` blocks risky tools; `Stop` prevents completion without final advisor review; `SubagentStop` validates advisor output shape.                                |
| OpenRouter                       | `ANTHROPIC_BASE_URL=https://openrouter.ai/api`      | Official OpenRouter docs say Claude Code can use its Anthropic-compatible endpoint directly. Verify exact model aliases per rollout.                                    |
| LiteLLM                          | `base_url=http://host:4000` or `/anthropic` path    | LiteLLM docs show Anthropic SDK clients pointed at proxy base URLs and virtual keys. Claude Code official docs mention both unified and pass-through endpoint patterns. |
| Zod 4                            | TypeScript 6.x                                      | Use `safeParse` for hook input/output and `z.toJSONSchema()` to generate prompt-visible contracts.                                                                      |
| OpenTelemetry JS 0.218.x         | Node runtime                                        | Use `NodeSDK`, OTLP trace exporter, and OTLP metric exporter when moving beyond local logs.                                                                             |

## Recommended MVP Stack

1. **Claude Code Teams project assets**
   - `.claude/agents/advisor.md`
   - `.claude/settings.json`
   - `.claude/commands/advisor-doctor.md`
   - local hook scripts under `.claude/hooks/` or project `scripts/`

2. **Anthropic-compatible managed gateway**
   - Start with OpenRouter for validation:
     - `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
     - `ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY`
   - Keep LiteLLM as the production self-host path.

3. **Semantic model aliases**
   - `sonnet` = executor model, e.g. GLM or other cost-effective coding model.
   - `opus` = advisor model, e.g. GPT-5.5 or strongest available reasoning/coding reviewer.
   - `haiku` = cheap classifier/summarizer if needed later.

4. **TypeScript policy engine**
   - Zod schemas for advisor outputs and policy config.
   - Vitest for policy tests.
   - Pino JSONL logs for audit.
   - Commander CLI for init/doctor/validate/rollback.

5. **Hook-enforced consultation**
   - `PreToolUse`: block or require advisor before high-risk Bash/Edit/Write patterns.
   - `PostToolUse`: detect repeated failures and trigger escalation.
   - `Stop`: require final advisor review before task completion.
   - `SubagentStop`: validate advisor output shape and prevent empty/non-actionable advisor responses.

## Sources

- Context7 `/websites/code_claude` — Claude Code LLM gateway, hooks, subagents, settings.
- Context7 `/websites/litellm_ai` — LiteLLM Anthropic-compatible proxy, virtual keys, aliases.
- Context7 `/anthropics/anthropic-sdk-typescript` — Anthropic TypeScript SDK Messages API, streaming, tool runner.
- Context7 `/websites/zod_dev_v4` — Zod 4 parsing and JSON Schema conversion.
- Context7 `/open-telemetry/opentelemetry-js` — NodeSDK, OTLP traces/metrics exporters.
- OpenRouter docs search result — Claude Code integration and Anthropic-compatible endpoint.
- npm registry checks — current versions for TypeScript, Anthropic SDK, Claude Agent SDK, Zod, Vitest, tsx, Pino, Commander, OpenTelemetry, yaml.
- PyPI registry check — LiteLLM 1.85.0.

---

_Stack research for: pure client-side Advisor Mode in Claude Code Teams_
_Researched: 2026-05-19_
