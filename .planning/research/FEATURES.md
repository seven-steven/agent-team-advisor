# Feature Research

**Domain:** Production-grade client-side advisor-mode coding-agent orchestration for Claude Code / Agent Teams
**Researched:** 2026-05-19
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature                            | Why Expected                                                                                                                                                                                                      | Complexity | Notes                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisor/executor role separation   | Core promise is cheaper/faster executor doing work while stronger advisor reviews risk, uncertainty, failures, and final quality. Without explicit role separation, this is just another multi-agent prompt pack. | MEDIUM     | Advisor must be read-only by default; executor keeps tool execution authority. Claude Code subagent definitions support model selection and restricted tool sets, so encode advisor as a dedicated read-only agent.                                                         |
| Automatic advisor trigger policy   | Project value depends on autonomous consultation, not manual user judgment. Users leave if they must remember when to ask the stronger model.                                                                     | HIGH       | Implement policy for high-risk tools, repeated failures, high uncertainty, broad refactors, security-sensitive files, dependency changes, and pre-completion review. Hooks can block or add guidance before tools; subagent stop/final hooks can enforce completion review. |
| High-risk tool gate                | Coding agents can damage files, secrets, git state, or infrastructure. Production systems need a before-action gate for risky Bash/Edit/Write/MultiEdit operations.                                               | HIGH       | Use `PreToolUse` hooks for destructive shell commands, credential files, env files, lockfiles, migrations, auth/security code, CI/deploy config, broad file edits, and git operations. Gate should request advisor assessment or human approval depending on severity.      |
| Final review before completion     | Agent output that “looks done” is not enough for production use. Users expect final validation that tests ran, diffs are coherent, and acceptance criteria were met.                                              | MEDIUM     | Use Stop/SubagentStop-style enforcement: block completion until advisor returns structured PASS/CONCERNS/FAIL and executor records verification evidence.                                                                                                                   |
| Structured advisor output contract | Free-form advice is hard to enforce, audit, or route. Production orchestration needs machine-readable fields.                                                                                                     | MEDIUM     | Require severity, confidence, decision, blocking findings, recommended next action, validation checklist, files inspected, evidence gaps, and whether human approval is required.                                                                                           |
| Provider alias routing             | The project depends on Anthropic-compatible provider aliases mapping Sonnet/Opus/Haiku semantics to third-party models. Users expect routing to be configurable and inspectable.                                  | MEDIUM     | Support semantic aliases such as executor, advisor, cheap-review, final-review, with concrete provider/model mappings and fallback disabled by default unless explicitly configured.                                                                                        |
| Routing observability              | Users need to know which real model answered, what it cost, latency, tokens, and why it was invoked. Without this, multi-model savings and quality claims are unverifiable.                                       | MEDIUM     | Log alias, resolved provider/model, trigger reason, token counts, latency, cost estimate, request id/session id, and advisor decision. Keep logs local-first by default.                                                                                                    |
| Budget controls                    | Strong advisor calls can become expensive and slow. Production users expect limits.                                                                                                                               | MEDIUM     | Provide per-session and per-project advisor budgets, max advisor calls per task, trigger cooldowns, severity thresholds, and hard stop behavior when budget is exceeded.                                                                                                    |
| Audit trail / decision journal     | Advisor mode must be auditable: why a gate fired, what the advisor said, whether executor accepted/overrode it, and what changed afterward.                                                                       | MEDIUM     | Store append-only local JSONL/markdown run records with session id, hook event, trigger, model route, advisor output, executor decision, verification commands, and resulting git diff/commit if available.                                                                 |
| Read-only advisor enforcement      | A stronger model should not directly modify code or run tools in this architecture. Users expect the advisor to reduce risk, not become another unbounded actor.                                                  | LOW        | Configure advisor subagent with read/search/diff-only tools. Do not give Write/Edit/Bash. Add hook assertions that flag tool-permission drift.                                                                                                                              |
| Project-scoped policy files        | Teams need versioned, reviewable advisor policy tied to the repo rather than hidden global state.                                                                                                                 | LOW        | Put advisor agent definitions, trigger policy, route policy, and hook config under project `.claude/` or equivalent versioned assets; allow user-local overrides only for secrets and provider keys.                                                                        |
| Human escalation path              | Some decisions cannot be delegated to models: destructive commands, production deploys, force pushes, credential changes, legal/compliance-sensitive edits.                                                       | MEDIUM     | Advisor can recommend escalation; hooks must require explicit user approval for configured critical classes. Record approver, prompt, and decision.                                                                                                                         |
| Verification evidence capture      | Users need proof that the executor followed advice and ran checks.                                                                                                                                                | MEDIUM     | Capture test/lint/typecheck commands, exit status, concise output summary, modified files, and residual risks. Do not store full logs by default unless configured.                                                                                                         |
| Failure loop detection             | A common value case is escalating after repeated failed commands, tests, or edits. Users expect the stronger model to diagnose loops.                                                                             | MEDIUM     | Track repeated failing commands, same test failures, repeated hook blocks, and oscillating edits; trigger advisor after a configurable threshold, usually 2-3 failures.                                                                                                     |
| Local-first operation              | The project is explicitly client-side and should not require a hosted orchestrator. Users choosing Claude Code workflows expect local repository control.                                                         | MEDIUM     | Keep orchestration in Claude Code agents/hooks plus local scripts/config. Any remote telemetry must be opt-in.                                                                                                                                                              |
| Installation/scaffold command      | Users need a fast path from idea to working setup.                                                                                                                                                                | LOW        | Provide a command or script that writes agent definitions, hooks, settings examples, route policy examples, and a sample audit log directory.                                                                                                                               |
| Safe rollback / disable switch     | Production users need to recover from bad policy, runaway advisor calls, or provider outages.                                                                                                                     | LOW        | Include an environment flag and project setting to disable advisor enforcement, revert to warning-only mode, or pin to a known route policy. Log when bypassed.                                                                                                             |
| Documentation and examples         | Multi-agent orchestration has many moving parts; missing examples makes adoption fail.                                                                                                                            | LOW        | Include reference workflows for greenfield feature, bugfix, refactor, security-sensitive change, repeated test failure, and final review.                                                                                                                                   |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature                                   | Value Proposition                                                                                                                     | Complexity | Notes                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Risk-scored advisor triggers              | Better than static “always ask Opus” rules: lowers cost while preserving quality on consequential steps.                              | HIGH       | Compute risk from tool type, path patterns, diff size, test failures, uncertainty language, dependency/security areas, and git state. Trigger advisor only above threshold.    |
| Advisor decision replay                   | Makes advisor behavior debuggable and tunable. Users can replay a trigger payload against another advisor model or revised policy.    | HIGH       | Store sanitized trigger context and advisor response. Provide replay command that does not re-run executor actions.                                                            |
| Route A/B and shadow evaluation           | Lets teams prove that GPT-5.5/GLM or other provider pairings improve outcomes before enforcing them.                                  | HIGH       | Run advisor in shadow mode, compare findings with baseline/final human result, and compute false-positive/false-negative style metrics.                                        |
| Model capability profiles                 | Users can swap providers without rewriting workflow logic.                                                                            | MEDIUM     | Maintain profiles for executor/advisor aliases: context window, tool reliability, cost, latency, JSON reliability, coding-review strength, and recommended trigger thresholds. |
| Policy linter and dry run                 | Prevents broken hooks, overbroad triggers, missing read-only restrictions, and runaway budgets before users install.                  | MEDIUM     | Validate agent frontmatter, hook matchers, denied tools, route mappings, budgets, and log paths. Dry-run against recorded sessions.                                            |
| Explainable trigger reports               | Builds user trust by explaining why advisor was invoked or skipped.                                                                   | MEDIUM     | Output “triggered because: migration file + failed test twice + broad edit” or “skipped because risk below threshold and budget exhausted.”                                    |
| Advisor override protocol                 | Keeps executor autonomous while making overrides visible.                                                                             | MEDIUM     | Executor may override non-blocking advice only by recording rationale and verification evidence; blocking advice requires user approval or remediation.                        |
| Multi-advisor quorum for critical reviews | Reduces single-model blind spots for security, data loss, or large refactors.                                                         | HIGH       | Use two independent advisor models only for high severity. Require agreement or escalate to human when advisors conflict. Avoid as MVP default due cost/latency.               |
| Context minimization packer               | Protects latency/cost and reduces accidental secret exposure.                                                                         | HIGH       | Build structured advisor packets from diff, failing outputs, policy, relevant files, and acceptance criteria; avoid dumping full repository or full logs.                      |
| Advisor policy test suite                 | Treats orchestration as code. Teams can add fixtures proving that certain prompts/tool calls trigger or do not trigger advisor gates. | MEDIUM     | Unit tests for route policy, risk scoring, hook parsing, budget exhaustion, and final review enforcement.                                                                      |
| Local dashboard / run viewer              | Competitors emphasize dashboards, logs, diffs, and mission viewers. A lightweight local viewer improves debuggability.                | HIGH       | Defer until logs are stable. Show sessions, trigger reasons, model route, cost, advice, executor decision, diffs, and verification summary.                                    |
| Team profile presets                      | Speeds adoption for different risk appetites.                                                                                         | LOW        | Presets: solo-low-cost, team-balanced, security-strict, CI-review-only. Presets should be transparent config, not opaque magic.                                                |
| Provider health and fallback simulation   | Avoids silent quality drops when a provider is down or degraded.                                                                      | MEDIUM     | Health check providers and show planned fallback. Default should fail closed for advisor-critical gates unless user opts into fallback.                                        |
| Learning loop from accepted findings      | Improves policy over time without building a full ML product.                                                                         | HIGH       | Track which advisor findings were accepted, rejected, or false positives; suggest threshold/path-policy adjustments. Keep local and explicit.                                  |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature                                                    | Why Requested                                               | Why Problematic                                                                                                               | Alternative                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Advisor directly edits code or runs Bash                   | Seems faster: let the strongest model fix the issue itself. | Violates project safety constraint, blurs accountability, increases risk of conflicting edits, and makes audit harder.        | Keep advisor read-only; executor applies changes after advisor recommendation.                             |
| Always consult advisor on every step                       | Appears safest and easiest to implement.                    | Destroys cost/latency advantage and trains users to ignore advisor noise.                                                     | Use risk-scored triggers plus final review.                                                                |
| Fully autonomous high-risk approvals                       | Attractive for unattended operation.                        | Destructive actions, credential changes, deploys, and force pushes require human authority. Model approval is not sufficient. | Advisor recommends, hook requires user approval for critical classes.                                      |
| Opaque hosted control plane as requirement                 | Dashboards and cloud sync are attractive.                   | Conflicts with pure client-side/local-first value and raises IP/security concerns.                                            | Local logs first; optional local viewer; remote export only opt-in.                                        |
| Silent provider fallback                                   | Maximizes task completion when a provider fails.            | Can silently replace a strong advisor with a weaker model and invalidate safety assumptions.                                  | Fail closed for critical gates; allow explicit fallback policies with visible route logging.               |
| Unlimited parallel agents                                  | Looks powerful and competitor-friendly.                     | Causes worktree conflicts, review bottlenecks, cost spikes, and hard-to-debug state.                                          | Dependency-aware bounded parallelism with worktree isolation and per-session budgets.                      |
| Full transcript or repository upload to advisor by default | Simplifies context gathering.                               | Wastes tokens, increases privacy risk, and can bury the relevant signal.                                                      | Minimal advisor packets: diff, targeted snippets, failures, policy, and acceptance criteria.               |
| “One config works for every repo”                          | Reduces setup friction.                                     | Risk differs by codebase: infra, auth, migrations, regulated domains, and monorepos need different policies.                  | Provide presets plus project-scoped policy overrides.                                                      |
| Advisor as final source of truth                           | Users may want a decisive oracle.                           | Models can be wrong; executor/user need evidence-based decisions.                                                             | Advisor returns confidence and evidence gaps; final completion depends on verification.                    |
| Auto-commit/auto-push after advisor pass                   | Feels like end-to-end automation.                           | Git operations are high-risk and user/team workflows differ.                                                                  | Generate commit/PR suggestions; require explicit user approval for commits/pushes unless configured in CI. |
| Complex visual orchestration before reliable gates         | Dashboards are compelling demos.                            | UI polish does not solve core correctness, safety, routing, or auditability.                                                  | Ship CLI/config/logging first; add viewer after event schema stabilizes.                                   |
| Global-only policy installation                            | Easier to implement once.                                   | Hidden policy causes non-reproducible team behavior and makes reviews impossible.                                             | Version project policy; reserve global/user config for credentials and personal defaults.                  |

## Feature Dependencies

```
Provider alias routing
    └──requires──> Route policy schema
                       └──enables──> Routing observability
                                         └──enables──> Budget controls

Advisor/executor role separation
    └──requires──> Advisor agent definition
                       └──requires──> Read-only advisor enforcement
                       └──enables──> Structured advisor output contract

Automatic advisor trigger policy
    └──requires──> Risk taxonomy
    └──requires──> Hook integration
                       └──enables──> High-risk tool gate
                       └──enables──> Failure loop detection
                       └──enables──> Final review before completion

Audit trail / decision journal
    └──requires──> Event schema
    └──requires──> Routing observability
    └──requires──> Structured advisor output contract
                       └──enables──> Advisor decision replay
                       └──enables──> Policy dry run
                       └──enables──> Local dashboard / run viewer

Human escalation path
    └──requires──> Risk taxonomy
    └──requires──> High-risk tool gate
                       └──conflicts──> Fully autonomous high-risk approvals

Context minimization packer
    └──enhances──> Advisor cost control
    └──enhances──> Privacy/local-first posture
    └──enables──> Multi-advisor quorum for critical reviews
```

### Dependency Notes

- **Provider alias routing requires a route policy schema:** The system cannot audit or enforce model choices if alias-to-real-model mappings are implicit.
- **Budget controls require routing observability:** Per-model budgets need resolved model, token, latency, and cost data, not just “advisor was called.”
- **Automatic trigger policy requires hook integration:** Prompt instructions alone are insufficient for enforced high-risk gates and final review.
- **Final review requires structured advisor output:** Completion gates need parseable decisions, not prose.
- **Decision replay requires audit event schema:** Replay depends on stable captured trigger payloads and normalized advisor outputs.
- **Local dashboard requires stable logs first:** Build durable event schema before UI; otherwise the dashboard will force premature data-model churn.
- **Human escalation conflicts with fully autonomous high-risk approvals:** Critical action classes must fail closed or pause for user authority.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Advisor and executor agent definitions — proves the core role split and read-only advisor posture.
- [ ] Project-scoped route policy example — maps executor/advisor aliases to real third-party models and keeps routing inspectable.
- [ ] Structured advisor response schema — enables gates, audit, and downstream automation.
- [ ] High-risk PreToolUse gate — validates that advisor can be enforced before consequential actions.
- [ ] Failure-loop trigger — validates the key “ask stronger model when stuck” workflow.
- [ ] Final review gate — validates that completion quality improves before user handoff.
- [ ] Local audit log — records trigger reason, route, advisor output, executor decision, cost/latency fields when available, and verification summary.
- [ ] Budget limits and kill switch — prevents runaway cost/latency and gives users rollback confidence.
- [ ] Installation scaffold and examples — makes the greenfield system usable without hand-assembling hooks and agent files.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Risk-scored trigger thresholds — add when static trigger rules create too much noise or cost.
- [ ] Policy linter and dry-run mode — add once users start editing policies.
- [ ] Advisor decision replay — add after audit schema stabilizes.
- [ ] Model capability profiles — add after at least two provider/model combinations are tested.
- [ ] Explainable trigger reports — add when users need to tune false positives.
- [ ] Provider health checks — add when real provider instability or fallback requests appear.
- [ ] Preset policies — add after observing common solo/team/security configurations.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Local dashboard / run viewer — valuable but only after event/log schema is stable.
- [ ] Multi-advisor quorum — high-value for critical code, but expensive and complex; reserve for strict/security profiles.
- [ ] Route A/B and shadow evaluation — important for maturity, not required to validate the core workflow.
- [ ] Learning loop from accepted findings — needs enough usage data to avoid premature heuristics.
- [ ] Cross-CLI orchestration beyond Claude Code — competitors support many CLIs, but this project should first win in Claude Code/Agent Teams semantics.

## Feature Prioritization Matrix

| Feature                              | User Value | Implementation Cost | Priority |
| ------------------------------------ | ---------- | ------------------- | -------- |
| Advisor/executor role separation     | HIGH       | MEDIUM              | P1       |
| Read-only advisor enforcement        | HIGH       | LOW                 | P1       |
| Structured advisor output contract   | HIGH       | MEDIUM              | P1       |
| Provider alias routing               | HIGH       | MEDIUM              | P1       |
| High-risk tool gate                  | HIGH       | HIGH                | P1       |
| Failure-loop detection               | HIGH       | MEDIUM              | P1       |
| Final review before completion       | HIGH       | MEDIUM              | P1       |
| Audit trail / decision journal       | HIGH       | MEDIUM              | P1       |
| Budget controls                      | HIGH       | MEDIUM              | P1       |
| Safe rollback / disable switch       | HIGH       | LOW                 | P1       |
| Installation scaffold                | MEDIUM     | LOW                 | P1       |
| Human escalation path                | HIGH       | MEDIUM              | P2       |
| Verification evidence capture        | HIGH       | MEDIUM              | P2       |
| Risk-scored advisor triggers         | HIGH       | HIGH                | P2       |
| Policy linter and dry run            | MEDIUM     | MEDIUM              | P2       |
| Explainable trigger reports          | MEDIUM     | MEDIUM              | P2       |
| Model capability profiles            | MEDIUM     | MEDIUM              | P2       |
| Advisor decision replay              | MEDIUM     | HIGH                | P2       |
| Provider health checks               | MEDIUM     | MEDIUM              | P2       |
| Local dashboard / run viewer         | MEDIUM     | HIGH                | P3       |
| Multi-advisor quorum                 | MEDIUM     | HIGH                | P3       |
| Route A/B and shadow evaluation      | MEDIUM     | HIGH                | P3       |
| Learning loop from accepted findings | MEDIUM     | HIGH                | P3       |
| Cross-CLI orchestration              | MEDIUM     | HIGH                | P3       |

**Priority key:**

- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature                                    | Competitor / Ecosystem Evidence                                                                                                                                                                                                                                                  | Our Approach                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-agent orchestration                  | Dispatch, Armada, AgentPipe, crewswarm, and similar tools market multi-agent coding orchestration across Claude/Codex/Gemini/OpenCode-style agents. Confidence: MEDIUM from WebSearch snippets, not direct page fetch.                                                           | Narrow scope to advisor-mode orchestration inside Claude Code/Agent Teams first; do not chase generic multi-agent fleet management in MVP.              |
| Dashboards, mission viewers, logs, diffs   | Armada search snippets emphasize real-time dashboard, mission viewer, log tail, diff viewer, full mission history; Dispatch snippets emphasize Kanban, git worktrees, PR generation, review; AgentPipe emphasizes monitoring dashboard and live metrics. Confidence: MEDIUM/LOW. | Treat local logs and audit schema as table stakes; defer dashboard until v2.                                                                            |
| Git worktree isolation                     | Claude Code official/current docs via Context7 and search indicate worktrees/subagent isolation are standard for parallel sessions/subagents. Confidence: HIGH for Claude Code capability, MEDIUM for ecosystem usage.                                                           | Use worktree isolation only when code-writing subagents exist; advisor remains read-only and does not need its own write worktree in MVP.               |
| Human approval and review gates            | HARP and agent-governance search results emphasize approvals tied to exact diffs/action evidence and audit trails. Confidence: MEDIUM.                                                                                                                                           | Build explicit human escalation for critical classes; advisor alone cannot approve destructive actions.                                                 |
| Local-first orchestration                  | crewswarm and AgentPipe position around local-first/self-hosted/open-source orchestration. Confidence: MEDIUM from search snippets.                                                                                                                                              | Make local-first a core table stake: no hosted dependency, local audit logs, optional exports only.                                                     |
| Provider/model breadth                     | AgentPipe snippets list many CLI agents/providers; Dispatch/Armada list multiple coding agents. Confidence: MEDIUM/LOW.                                                                                                                                                          | Support configurable Anthropic-compatible provider aliasing first; avoid per-provider workflow forks.                                                   |
| Production-grade idempotency / task leases | crewswarm search snippets highlight task lease/deduplication/DLQ. Confidence: LOW/MEDIUM.                                                                                                                                                                                        | Defer true task lease/DLQ unless building a daemon/runtime. For Claude Code hooks, implement idempotent audit events and duplicate-trigger suppression. |

## Sources

- Context7 `/anthropics/claude-code` docs excerpts for hooks: `PreToolUse`, command/prompt hooks, blocking with exit code/decision, `Stop`/`SubagentStop`, hook payload fields, settings-managed hooks. Confidence: HIGH.
- Context7 `/anthropics/claude-code` docs excerpts for subagents: agent frontmatter, model selection, restricted tools, read-only tool sets, autonomous subprocess/context isolation, worktree isolation. Confidence: HIGH.
- Context7 `/anthropics/claude-code` docs excerpts for settings: managed settings, permission rules, hook enforcement, sandbox/network settings. Confidence: HIGH.
- [Claude Code settings - Claude Code Docs](https://code.claude.com/docs/en/configuration) — discovered by WebSearch; direct fetch blocked by environment safety verification. Confidence: MEDIUM.
- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents) — discovered by WebSearch; direct fetch blocked by environment safety verification. Confidence: MEDIUM.
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) — discovered by WebSearch; direct fetch blocked by environment safety verification. Confidence: MEDIUM.
- [Run parallel sessions with worktrees — Claude Code Docs](https://code.claude.com/docs/en/worktrees) — WebSearch result plus Context7 excerpts align on worktree/subagent isolation. Confidence: HIGH/MEDIUM.
- [Dispatch — Features: AI Coding Agent Orchestration Platform](https://dispatch.codes/features) — competitor feature snippets from WebSearch; direct fetch blocked. Confidence: MEDIUM/LOW.
- [Armada — Multi-Agent AI Orchestration](https://armadago.ai/) — competitor feature snippets from WebSearch; direct fetch blocked. Confidence: MEDIUM/LOW.
- [AgentPipe - Multi-Agent AI Orchestration](https://agentpipe.ai/) — competitor feature snippets from WebSearch; direct fetch blocked. Confidence: MEDIUM/LOW.
- [crewswarm — Multi-Agent AI Coding Platform](https://crewswarm.ai/) — competitor feature snippets from WebSearch; direct fetch blocked. Confidence: MEDIUM/LOW.
- [HARP — Human Authorization & Review Protocol](https://harp-protocol.github.io/) — search result used for approval/audit/diff-bound human authorization pattern. Confidence: MEDIUM.
- [AI coding agent guardrails: sandboxing, prompt caching, and code review gates](https://www.propelcode.ai/blog/ai-coding-agent-guardrails-sandboxing-prompt-caching-code-review) — search result used for review-gate pattern. Confidence: LOW/MEDIUM.
- [AI Agent Governance at Scale: Audit Logs, Approval Gates, and Kill Switches](https://www.onefrequencyconsulting.com/insights/agent-governance-at-scale-audit-logs-approval-gates) — search result used for governance pattern. Confidence: LOW/MEDIUM.

---

_Feature research for: client-side advisor-mode coding-agent orchestration_
_Researched: 2026-05-19_
