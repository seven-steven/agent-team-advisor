# Pitfalls Research

**Domain:** Pure client-side Advisor Mode for multi-model coding-agent orchestration in Claude Code / Agent Teams
**Researched:** 2026-05-19
**Confidence:** MEDIUM

Confidence is MEDIUM because current official Claude Code pages were discoverable via search and Context7 resolved the official `anthropics/claude-code` repository, but direct `WebFetch` against Anthropic docs was blocked in this environment. Claims about hooks, subagents, model aliases, and telemetry are grounded in Context7 extracts from the official repository plus official docs search results; provider-compatibility pitfalls are partly ecosystem-derived and should be validated against the selected gateway/provider during implementation.

## Critical Pitfalls

### Pitfall 1: Treating Prompt Policy as Enforcement

**What goes wrong:**
The executor is instructed to consult the advisor before high-risk actions, repeated failures, or final completion, but nothing actually forces that behavior. Under time pressure or context drift, the executor skips consultation and proceeds directly to Bash/Edit/Write/MultiEdit or marks the task complete without advisor review.

**Why it happens:**
Teams overestimate natural-language policy and underestimate agent autonomy. Claude Code hooks are the deterministic enforcement layer; prompt instructions are advisory unless paired with `PreToolUse`, `PostToolUse`, `Stop`, and `SubagentStop` gates.

**How to avoid:**
Implement enforcement as hooks first, prompts second:

- `PreToolUse` hook for high-risk tools and patterns: destructive shell commands, broad edits, git operations, credential/config changes, dependency installs, network calls, provider setting changes.
- `PostToolUse` hook for repeated failures: detect consecutive failed commands/tests or repeated edits to the same file and require advisor escalation.
- `Stop` hook for final review: block completion unless the transcript contains a structured advisor verdict or an explicit low-risk exemption.
- Hook output must use machine-readable decisions (`allow`, `deny`, `ask` / stop `approve`, `block`) and include a reason.
- Keep an allowlisted low-risk path for simple read-only operations so the system remains usable.

**Warning signs:**

- Advisor invocation exists only in agent prompt text.
- Demo succeeds when the executor remembers to ask, but no tests prove hooks block skipped consultation.
- High-risk Bash/Edit/Write actions run without a trigger reason being logged.
- Final answer can be produced without advisor-review evidence.

**Phase to address:**
Phase 1: Hook Enforcement Skeleton. This is foundational and must precede provider routing and polished agent definitions.

---

### Pitfall 2: Over-Broad Hooks That Create Friction, Latency, and Bypass Pressure

**What goes wrong:**
Every tool call triggers advisor review. The workflow becomes slow, expensive, and annoying; users or executors disable hooks, broaden permissions, or route everything through less-visible paths.

**Why it happens:**
The team correctly identifies hooks as enforcement but fails to classify risk. A pure client-side advisor system needs selective escalation, not blanket interception.

**How to avoid:**
Define a risk taxonomy before writing hook scripts:

- Always allow: Read, directory listing, harmless status commands, narrow grep/search.
- Log-only: normal tests, type checks, package metadata reads.
- Ask/advisor: broad file writes, multi-file refactors, dependency changes, network or deployment commands, permission/settings changes, repeated failures, final completion.
- Deny by default: destructive git/file commands without explicit user request, credential exfiltration patterns, shell pipes that send project contents to unknown endpoints.
  Use fast deterministic command hooks for common cases and reserve prompt/advisor hooks for ambiguous cases. Add per-trigger budgets and cooldowns.

**Warning signs:**

- Hook matcher is `.*` for most lifecycle events with no risk classification.
- Advisor gets called on every formatting/test command.
- Users ask how to disable hooks during normal work.
- Token/cost spikes during trivial tasks.

**Phase to address:**
Phase 1: Hook Enforcement Skeleton; refine in Phase 4: Budget and UX Hardening.

---

### Pitfall 3: Letting the Advisor Execute Instead of Advise

**What goes wrong:**
The advisor model receives write tools, shell tools, or broad inherited tools and starts modifying code, running commands, or changing settings. The executor/advisor boundary collapses, making accountability unclear and increasing risk because the expensive/high-capability model can directly perform unsafe actions.

**Why it happens:**
Subagents often inherit tools unless explicitly constrained. Agent definitions may omit `tools` or `disallowedTools`, and the team assumes the role prompt “read-only advisor” is enough.

**How to avoid:**
Make read-only status structural:

- Advisor agent definition explicitly allows only read/search/context tools needed for review.
- Disallow Bash, Write, Edit, MultiEdit, notebook editing, package install, git mutation, and settings mutation.
- If the platform supports independent permissions / `permissionMode`, configure advisor to ask or deny for mutating tools.
- Add a `SubagentStop` or transcript audit hook that fails if advisor used any mutating tool.
- Advisor output schema must be recommendation-only: risk rating, blocking findings, verification checklist, and explicit “executor owns execution” statement.

**Warning signs:**

- Advisor agent frontmatter has no `tools` field or uses inherited tools.
- Advisor returns patches or says “I changed…” instead of “recommend changing…”.
- Audit logs cannot distinguish executor actions from advisor actions.
- The advisor’s transcript contains Bash/Edit/Write tool calls.

**Phase to address:**
Phase 2: Agent Boundary and Advisor Contract.

---

### Pitfall 4: Provider Alias Routing Drifts from Semantic Intent

**What goes wrong:**
`sonnet`, `opus`, and `haiku` aliases are mapped to third-party models, but the real model behavior, context window, tool support, streaming semantics, or reasoning quality does not match what the agent prompts assume. The executor may be too weak for orchestration, or the advisor may not be materially better than the executor.

**Why it happens:**
Anthropic-compatible routing can make different providers look syntactically similar while hiding semantic differences. Teams validate that requests return responses but do not validate tool-use behavior, stop reasons, streaming chunks, system prompts, long-context behavior, or failure modes.

**How to avoid:**
Create a provider conformance suite before relying on routing:

- Verify `/v1/messages` compatibility for system prompts, tool use, tool result blocks, streaming, stop reasons, error formats, usage fields, and large context.
- Verify alias mapping by logging requested alias, resolved provider model, provider request id, and returned model id on every advisor/executor call.
- Run golden tasks: simple tool use, multi-step edit, failed test diagnosis, high-risk command gate, final review, and refusal/safety behavior.
- Pin known-good model/provider versions where possible; do not silently float aliases in production workflows.
- Define fallback: fail closed for missing advisor, fail open only for explicitly low-risk actions.

**Warning signs:**

- Provider integration test checks only “hello world”.
- Logs show `opus` requested but not the concrete model served.
- Tool-call JSON occasionally malformed or missing under streaming.
- Advisor verdict quality is inconsistent across identical tasks.

**Phase to address:**
Phase 3: Provider Routing and Conformance.

---

### Pitfall 5: Blind Spots in Observability Make Safety Unverifiable

**What goes wrong:**
The system cannot answer: Why was advisor called? Why was it skipped? Which model answered? How many tokens did each role consume? What did hooks block? What did the executor do after advisor advice? Without this, advisor mode becomes a black box and regressions are discovered only after bad changes land.

**Why it happens:**
Teams log final outputs but not orchestration events. Claude Code transcripts, hooks, provider calls, and cost metrics remain disconnected. Provider-compatible gateways may omit or normalize usage fields differently.

**How to avoid:**
Define an event schema from the start:

- `advisor.triggered`: trigger type, risk score, tool/action, file scope, failure count, exemption id.
- `advisor.verdict`: risk level, blocking findings, required checks, confidence.
- `hook.decision`: event, matcher, decision, reason, latency, script version.
- `provider.route`: requested alias, resolved model, provider, request id, latency, token/cost fields.
- `executor.decision_after_advisor`: accepted/rejected/deferred with reason.
  Export via local JSONL first; add OpenTelemetry metrics once schema stabilizes. Treat missing route/cost fields as integration failures, not “unknown but fine”.

**Warning signs:**

- Debugging requires reading raw terminal transcripts manually.
- Cost can be seen only after the fact in provider billing.
- No metric for advisor skip rate or hook block rate.
- Provider logs do not correlate with Claude Code session ids.

**Phase to address:**
Phase 1 for minimal audit log; Phase 5 for OpenTelemetry/dashboard integration.

---

### Pitfall 6: Cost Controls Are Added After Users Already Distrust the Workflow

**What goes wrong:**
Advisor calls multiply during failure loops, final reviews, and broad context reviews. The expensive model is consulted repeatedly with large transcripts, driving high latency and cost. Users disable advisor mode because it feels unpredictable.

**Why it happens:**
The project goal intentionally uses a stronger advisor model, but no budgets, cooldowns, context caps, or escalation thresholds are built into the trigger design.

**How to avoid:**
Budget advisor usage as a first-class product constraint:

- Per-session advisor call cap and token cap.
- Per-trigger cooldown: repeated-failure escalation happens once per failure cluster, not every failed command.
- Context minimization: advisor receives task summary, diff/stat, failing logs excerpt, relevant files, and explicit question; not the full transcript by default.
- Low/medium/high risk tiers with different advisor models or depth.
- Cost event emitted for every provider call with cache read/write fields when available.
- Budget-exceeded behavior: block high-risk actions pending user approval; allow low-risk continuation with logged degradation.

**Warning signs:**

- Advisor prompt includes entire conversation by default.
- Same failing test triggers multiple advisor calls with no new evidence.
- No local estimate before invoking expensive model.
- Users cannot set a hard cap per task/session.

**Phase to address:**
Phase 4: Budget, Context, and Latency Controls.

---

### Pitfall 7: Failure Loops Escalate Too Late or Forever

**What goes wrong:**
The executor repeats the same failing command/edit cycle many times before asking for help, or it asks the advisor repeatedly without incorporating the advice. Both patterns waste time and tokens and can corrupt the working tree.

**Why it happens:**
“Repeated failure” is underspecified. Hooks need state: failure count, command similarity, touched files, advisor already consulted, and whether new evidence exists.

**How to avoid:**
Implement a failure-state machine:

- Track normalized command/test signature, exit code, key error hash, touched files, and attempt count.
- Escalate after N repeated failures or M edits to same failure area.
- After advisor advice, require executor to state selected remediation path before further mutation.
- If the same failure persists after advisor-guided attempts, stop and ask user with a concise blocked report.
- Reset only on materially new evidence, not any new command.

**Warning signs:**

- Multiple nearly identical test failures in transcript before advisor call.
- Advisor provides advice but executor continues a different unlogged plan.
- Hook state is stateless per invocation.
- Recovery involves broad rewrites instead of narrowing the failure.

**Phase to address:**
Phase 4: Failure Recovery and Autonomy Controls.

---

### Pitfall 8: Hook Configuration Itself Becomes an Attack or Bypass Surface

**What goes wrong:**
A model, user, or project script modifies `.claude/settings.json`, hook scripts, provider env vars, permissions, or agent definitions to weaken gates. The system still appears to run Advisor Mode but no longer enforces its guarantees.

**Why it happens:**
Client-side orchestration stores critical policy locally. If config changes are not monitored, safety controls are mutable by the same environment they protect.

**How to avoid:**
Protect configuration changes explicitly:

- Add hooks for settings/config/agent-definition modifications.
- Require advisor/user approval for changes under `.claude/`, hook directories, provider route config, environment bootstrap scripts, and budget policy.
- Hash or version hook scripts and emit script version in every hook decision.
- Provide a `doctor` command that validates expected hooks, advisor tool restrictions, provider routes, and telemetry sinks.
- Fail closed if required hooks are missing or unreadable.

**Warning signs:**

- Provider routes or hook scripts can be edited by normal executor flow.
- No startup validation of installed hooks.
- Hook logs do not include hook version/hash.
- “It works” demos do not include config tamper tests.

**Phase to address:**
Phase 1 for config guardrails; Phase 6 for hardening and rollback.

---

### Pitfall 9: Final Review Is Treated as a Rubber Stamp

**What goes wrong:**
The advisor performs a superficial final review after implementation is already complete, without enough context to catch issues, and the executor ignores or summarizes away blocking findings.

**Why it happens:**
Final review is placed at the end as ceremony rather than as a blocking acceptance gate with structured inputs and outputs.

**How to avoid:**
Define final review as a stop condition:

- `Stop` hook blocks completion unless a recent advisor verdict exists for non-trivial work.
- Advisor receives diff summary, changed files, verification commands/results, unresolved warnings, and original acceptance criteria.
- Advisor output includes `PASS`, `CONCERNS`, `FAIL`, or `BLOCKED` plus blocking findings and required verification.
- Executor must either fix blocking findings or explicitly ask the user to accept residual risk.

**Warning signs:**

- Final advisor prompt says only “review this” without acceptance criteria or verification results.
- Advisor verdict lacks severity and required actions.
- Executor final response omits advisor concerns.
- Stop hook checks only that advisor was called, not verdict freshness or status.

**Phase to address:**
Phase 2 for advisor output contract; Phase 4 for Stop-hook enforcement.

---

### Pitfall 10: Cross-Context Loss Between Executor, Advisor, and Hooks

**What goes wrong:**
Subagents run in separate contexts and return summarized results. Important details vanish: file paths, exact error snippets, user constraints, previous advisor decisions, or why an action was blocked. The executor then misapplies advice or repeats rejected actions.

**Why it happens:**
Context isolation is valuable for focus and cost, but the handoff protocol is underspecified. Teams rely on free-form summaries rather than structured artifacts.

**How to avoid:**
Use structured handoff packets:

- Task goal and acceptance criteria.
- Relevant file paths and line ranges.
- Proposed action and risk trigger.
- Evidence excerpts with command, exit code, and trimmed logs.
- Constraints from project/user instructions.
- Prior advisor verdict id and decision status.
  Store handoff packets as local JSON artifacts or transcript-linked JSONL events so hooks and final reviews can verify them.

**Warning signs:**

- Advisor asks for information the executor already had.
- Advice references wrong files or stale assumptions.
- Hook decisions are not visible to advisor.
- Final review lacks original user constraints.

**Phase to address:**
Phase 2: Agent Boundary and Handoff Protocol.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                               | Immediate Benefit       | Long-term Cost                                         | When Acceptable                                               |
| -------------------------------------- | ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Prompt-only advisor trigger policy     | Fast demo               | Executor can skip advisor; no auditability             | Never for high-risk/final gates                               |
| Advisor inherits all tools             | Less setup              | Advisor can mutate code; accountability collapse       | Never for production workflow                                 |
| Regex-only command risk classification | Simple hook script      | False negatives on shell composition and aliases       | Acceptable only for MVP with deny/ask fallback on unknowns    |
| No provider conformance suite          | Faster integration      | Silent model/stream/tool incompatibilities             | Never beyond prototype                                        |
| Logging only final answers             | Less storage/noise      | Impossible to debug routing, cost, or skipped advisors | Never for roadmap phases past MVP                             |
| Sending full transcript to advisor     | Better apparent context | High cost, latency, privacy exposure, context dilution | Only manual emergency diagnosis                               |
| Floating aliases without route audit   | Easy upgrades           | Behavior changes without notice                        | Only in local experiments                                     |
| No budget cap in MVP                   | Simpler implementation  | User distrust after surprise costs                     | Acceptable only for private spike with hard manual monitoring |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration                  | Common Mistake                                                               | Correct Approach                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Claude Code hooks            | Hook script exits success without structured decision, so policy is advisory | Return explicit hook decision and reason; test allow/deny/ask/block paths           |
| `PreToolUse` hooks           | Matching only tool names, not dangerous tool inputs                          | Match tool plus normalized command/input risk patterns                              |
| `Stop` hooks                 | Checking only task completion text                                           | Require fresh advisor verdict and verification evidence for non-trivial work        |
| Subagents                    | Omitting `tools` and relying on prompt to keep advisor read-only             | Explicitly restrict advisor tools and audit transcript for mutating calls           |
| Anthropic-compatible gateway | Assuming HTTP compatibility means semantic compatibility                     | Run conformance tests for tools, streaming, usage, stop reasons, errors, context    |
| Model aliases                | Mapping `opus`/`sonnet` but not logging concrete resolved model              | Log requested alias and resolved provider model on every call                       |
| Cost telemetry               | Trusting provider billing UI only                                            | Emit local per-call usage/cost events; reconcile with provider bills periodically   |
| Prompt caching               | Assuming cache savings across providers                                      | Treat cache fields as provider-specific; log cache read/write tokens when available |
| Settings/env vars            | Allowing executor to edit provider/hook config freely                        | Gate changes to `.claude/`, env bootstrap, route config, and hook scripts           |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap                                                | Symptoms                                           | Prevention                                                                  | When It Breaks                              |
| --------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Advisor on every tool call                          | Slow sessions, high token use, user disables hooks | Risk-tiered triggers and cooldowns                                          | Immediately in normal coding loops          |
| Full transcript advisor prompts                     | Long latency, expensive calls, weaker focus        | Structured context packet and log excerpts                                  | Any multi-file task or long session         |
| Stateless failure detection                         | Repeated loops or repeated advisor calls           | Persist failure signatures and advisor verdict ids                          | After first serious failing test/debug loop |
| Provider route without health checks                | Random stalls or missing advisor                   | Startup `doctor`, per-provider timeout, fail-closed policy for high risk    | First provider outage/rate limit            |
| Synchronous deep advisor checks for trivial actions | Bad interactive feel                               | Fast deterministic hook path, async/log-only for low risk                   | Daily usage                                 |
| Unbounded final review scope                        | Advisor review takes too long and misses key diff  | Feed changed files, diff summary, acceptance criteria, verification results | First non-trivial implementation            |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake                                                              | Risk                                                             | Prevention                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Advisor has mutating tools                                           | High: expensive model can directly perform unsafe edits/commands | Read-only tool allowlist, permission mode, transcript audit                             |
| Hook scripts interpolate untrusted tool input into shell             | High: command injection through hook enforcement layer           | Parse JSON safely, quote strictly, prefer Python/Node JSON parsing over shell eval      |
| Provider/gateway receives secrets or full repo context unnecessarily | High: data exfiltration/compliance risk                          | Context minimization, secret scanning before advisor/provider calls, provider allowlist |
| Config tampering not gated                                           | High: safety controls can be disabled silently                   | Guard `.claude/`, hook, route, env, permission changes with advisor/user approval       |
| Fail-open on advisor/provider outage for high-risk tools             | High: risky operations proceed without review                    | Fail closed for high-risk actions; allow only low-risk read-only continuation           |
| Logs contain secrets from prompts/tool outputs                       | Medium/High: audit trail leaks credentials                       | Redact known secret patterns before JSONL/OTel export; classify log fields              |
| Cost/budget controls rely on model self-report                       | Medium: runaway spend or denial of service                       | Enforce budget in hook/orchestration state independent of model text                    |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall                                      | User Impact                                | Better Approach                                                                        |
| -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Advisor blocks without explaining why        | User sees arbitrary friction               | Every block includes trigger, risk, required next action, override path if safe        |
| No visible mode/status                       | User cannot tell if advisor mode is active | Session banner/doctor output showing hooks, routes, budgets, advisor tool restrictions |
| Too many false positives                     | User disables safety                       | Calibrate risk rules with log-only mode before enforcing broad classes                 |
| Advisor advice is verbose and non-actionable | Executor/user cannot act on it             | Force schema: risk, blocking findings, recommended checks, concise rationale           |
| Budget exceeded behavior surprises user      | User distrusts tool                        | Show remaining budget and degradation behavior before expensive advisor calls          |
| Provider routing hidden behind aliases       | User cannot reason about quality/cost      | Surface alias-to-model map and route id in logs/status                                 |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Hook enforcement:** Advisor prompt exists — verify high-risk tool call is blocked when advisor verdict is absent.
- [ ] **Read-only advisor:** Advisor says it is read-only — verify tool allowlist prevents Bash/Edit/Write/MultiEdit and audit catches violations.
- [ ] **Provider routing:** Alias returns a model response — verify concrete model id, tool use, streaming, errors, usage fields, and long-context behavior.
- [ ] **Final review:** Advisor is called at task end — verify `Stop` hook blocks stale/missing/non-PASS verdicts.
- [ ] **Repeated failure escalation:** Executor can ask advisor — verify repeated failure signature triggers exactly one escalation per failure cluster.
- [ ] **Cost control:** Costs are visible in provider UI — verify local per-session caps and per-call usage/cost events.
- [ ] **Observability:** Logs exist — verify they correlate session id, hook decision, advisor verdict, provider request id, and executor follow-up decision.
- [ ] **Config safety:** Hooks are installed — verify config/hook/provider route changes are themselves gated and versioned.
- [ ] **Fallbacks:** Provider outage handled — verify high-risk actions fail closed and low-risk actions degrade clearly.
- [ ] **Context handoff:** Advisor gets a summary — verify it includes acceptance criteria, changed files, exact failure excerpts, and user constraints.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                         | Recovery Cost | Recovery Steps                                                                                                              |
| ------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Prompt-only enforcement shipped | MEDIUM        | Add hook gates; replay recent transcripts to identify skipped-advisor cases; add regression tests for each trigger          |
| Advisor had write tools         | HIGH          | Audit advisor transcripts; revert advisor-made changes if needed; restrict tools; add SubagentStop audit                    |
| Provider alias mismatch         | MEDIUM/HIGH   | Freeze route; run conformance suite; pin known-good model; add concrete model logging; update prompts for real capabilities |
| Cost runaway                    | MEDIUM        | Add hard session caps; summarize context; introduce cooldowns; review high-frequency triggers; expose budget status         |
| Missing observability           | MEDIUM        | Define JSONL event schema; instrument hooks/provider wrapper; backfill only from available transcripts where possible       |
| Hook false positives            | LOW/MEDIUM    | Move disputed rules to log-only; add risk tiers; require advisor only for ambiguous/high-risk patterns                      |
| Config tampering                | HIGH          | Restore known-good config; add config guard hooks; publish doctor check; require approval for policy changes                |
| Failure loop                    | MEDIUM        | Stop session; produce blocked report; add failure signature tracking and post-advisor remediation checkpoint                |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                           | Prevention Phase                                | Verification                                                                                              |
| --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Prompt policy without enforcement | Phase 1: Hook Enforcement Skeleton              | Simulated high-risk Bash/Edit/Write is blocked without advisor verdict                                    |
| Over-broad hooks                  | Phase 1 + Phase 4                               | Low-risk read-only actions bypass advisor; high-risk actions require advisor; false-positive rate tracked |
| Advisor mutates code              | Phase 2: Agent Boundary and Advisor Contract    | Advisor agent cannot access mutating tools; audit test fails on attempted mutation                        |
| Provider semantic drift           | Phase 3: Provider Routing and Conformance       | Golden conformance suite passes for selected executor/advisor providers                                   |
| Observability blind spots         | Phase 1 minimal logs + Phase 5 telemetry        | Every advisor decision correlates trigger, hook, provider request, cost, and executor follow-up           |
| Cost runaway                      | Phase 4: Budget, Context, and Latency Controls  | Per-session advisor call/token cap enforced; repeated failures do not trigger unbounded calls             |
| Failure loops                     | Phase 4: Failure Recovery and Autonomy Controls | Repeated failure fixture escalates once, then blocks after failed advisor-guided retry                    |
| Config bypass                     | Phase 1 guardrails + Phase 6 hardening          | Edits to `.claude/`, route config, hooks, and env bootstrap require approval and are logged               |
| Rubber-stamp final review         | Phase 2 contract + Phase 4 Stop enforcement     | Stop hook blocks missing/stale/FAIL advisor verdict for non-trivial work                                  |
| Cross-context loss                | Phase 2 Handoff Protocol                        | Advisor packet includes goal, constraints, evidence excerpts, changed files, and prior verdict id         |

## Suggested Phase Order From Pitfalls

1. **Hook Enforcement Skeleton** — install minimal `PreToolUse`, `PostToolUse`, `Stop`, config guard, and JSONL audit before optimizing anything else.
2. **Advisor Contract and Boundaries** — define read-only advisor agent, output schema, handoff packet, and final-review semantics.
3. **Provider Routing Conformance** — add alias mapping only after golden tests prove tool/stream/usage behavior.
4. **Autonomy, Failure, and Budget Controls** — add failure state machine, advisor cooldowns, context caps, and budget enforcement.
5. **Observability Integration** — graduate from local JSONL to OpenTelemetry/dashboard once event schema stabilizes.
6. **Hardening, Rollback, and Gray Release** — doctor command, config tamper checks, route rollback, provider outage behavior, false-positive calibration.

## Sources

- Context7: `/anthropics/claude-code` official repository extracts for hook `PreToolUse`, `PostToolUse`, `Stop`, hook JSON decisions, subagent context isolation, model selection, and tool restrictions. Source snippets reference `https://github.com/anthropics/claude-code`.
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) — official docs search result for hook events, JSON input/output formats, permissions behavior, and security notes. Confidence: MEDIUM.
- [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide) — official docs search result for workflow examples and lifecycle usage. Confidence: MEDIUM.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) — official docs search result for separate context windows, configurable tool access, model selection, permissions, and worktree isolation. Confidence: MEDIUM.
- [Claude Code settings](https://docs.anthropic.com/en/docs/claude-code/settings) — official docs search result for settings and environment configuration. Confidence: MEDIUM.
- [Claude Code environment variables](https://code.claude.com/docs/en/env-vars) — official docs search result for `ANTHROPIC_BASE_URL` and related provider routing env vars. Confidence: MEDIUM.
- [Claude Code LLM gateway](https://code.claude.com/docs/en/llm-gateway) — official docs search result for Anthropic-compatible gateway usage and `/v1/models` model discovery. Confidence: MEDIUM.
- [Claude Code monitoring usage](https://code.claude.com/docs/en/monitoring-usage) — official docs search result for OpenTelemetry usage, cost, token, tool, and session metrics. Confidence: MEDIUM.
- [Claude Code cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking) — official docs search result for per-step/per-model usage, total cost, prompt cache token fields, and failed conversation cost. Confidence: MEDIUM.
- [Anthropic OpenAI SDK compatibility](https://docs.anthropic.com/en/api/openai-sdk) — official docs search result for API compatibility considerations. Confidence: LOW/MEDIUM for this project because selected providers are not yet fixed.
- [Amazon Bedrock Anthropic Messages API](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-messages-api.html) — official provider documentation for Anthropic Messages API format, system prompts, tool use, and prompt caching. Confidence: MEDIUM for compatibility patterns.
- [Fireworks Anthropic compatibility](https://docs.fireworks.ai/tools-sdks/anthropic-compatibility) — provider documentation illustrating unsupported-field risks in Anthropic-compatible APIs. Confidence: LOW/MEDIUM as an ecosystem example.

---

_Pitfalls research for: pure client-side Advisor Mode coding-agent orchestration_
_Researched: 2026-05-19_
