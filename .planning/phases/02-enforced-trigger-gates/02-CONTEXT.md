# Phase 2: Enforced Trigger Gates - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

## Phase Boundary

This phase defines how Advisor Mode detects and escalates high-risk situations as policy-driven workflow gates. It covers risk scoring rules, repeated-failure escalation, human-approval decision gates, and protected configuration surfaces. It does **not** replace or unify host-agent tool permission systems such as Ask / Auto / bypassPermissions, and it does **not** turn Advisor Mode into a second tool-execution permission layer.

## Implementation Decisions

### Risk Trigger Rules

- **D-01:** High-risk detection should use combined policy rules rather than tool-only or explicit one-off lists. The policy model should be able to consider tool class, path class, action class, and related context together.
- **D-02:** Trigger rules should live in strategy/policy files under the repo-scoped advisor-mode configuration surface, with hooks acting as evaluators/enforcers rather than as the canonical source of rule definitions.
- **D-03:** Host-agent tool permissions remain outside Advisor Mode scope. Claude Code / OpenCode / Copilot / Codex style tool-use permission decisions stay with the host agent.
- **D-04:** Phase 2 uses a split boundary: Advisor Mode does not add a tool permission gate, but it may emit advisor-consultation signals and enforce workflow-level decision gates for critical or high-risk decisions.

### Repeated-Failure Escalation

- **D-05:** “Same failure pattern” should be grouped by a normalized failure signature, not by raw message text alone.
- **D-06:** A repeated-failure escalation should trigger after the same normalized signature is hit 2 times.
- **D-07:** When the threshold is hit, the system must emit an explicit advisor-consultation signal and record it structurally for audit/state purposes.
- **D-08:** Repeated-failure escalation does not block tool execution directly; the executor may continue, but the task path must be marked as needing advisor input and later disposition.

### Human Approval Decision Gates

- **D-09:** Human approval in Phase 2 is a decision gate, not a tool permission gate.
- **D-10:** Human approval should be required for these decision classes: irreversible decisions, security-boundary decisions, shared/production-impacting decisions, and governance-configuration decisions.
- **D-11:** When a human-approval decision point is detected, the workflow should stop at the decision point and wait for human disposition before that decision path proceeds.
- **D-12:** The human should receive a structured decision packet containing trigger reason, decision summary, risk level, options, advisor recommendation, expected consequences, and suggested verification points.
- **D-13:** Human-approval outcomes should support four states: approve, reject, revise, and defer.

### Protected Configuration Surface

- **D-14:** The protected surface includes policy/schema files, hooks/settings wiring, agent/command assets, and provider-route / credential-related control surfaces.
- **D-15:** Protected-surface detection should be path-class-first, with directory/prefix classes as the primary matching mechanism and explicit file exceptions only as needed.
- **D-16:** Touching protected surface should trigger advisor review by default; if the change also represents a governance, security-boundary, irreversible, or shared/production decision, it should escalate into the human-approval decision gate.
- **D-17:** Protected-surface changes must receive their own structured audit label so they can be filtered and reviewed separately from ordinary advisor events.

### Claude's Discretion

None — the user locked the key boundary decisions needed for downstream planning.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope and requirement mapping

- `.planning/PROJECT.md` — Product goal, hard constraints, and project-level decisions for Advisor Mode
- `.planning/REQUIREMENTS.md` — Phase-mapped requirements; Phase 2 covers GATE-01, GATE-02, GATE-04, GATE-05, GATE-06, SAFE-04
- `.planning/ROADMAP.md` — Phase 2 goal, dependency order, and success criteria
- `.planning/STATE.md` — Current execution state and phase progression context
- `.planning/phases/01-repo-scoped-advisor-foundation/01-CONTEXT.md` — Locked Phase 1 foundation decisions that Phase 2 must build on

### Existing advisor-mode assets and control surfaces

- `.claude/settings.json` — Current hook wiring surface and integration pattern
- `.claude/advisor-mode/policy.example.json` — Baseline repo-scoped policy shape that Phase 2 should extend into real trigger rules
- `.claude/advisor-mode/README.md` — Phase 1 scaffold boundary and runtime layout
- `.claude/advisor-mode/verdict.schema.json` — Existing structured verdict contract that may inform escalation payload shapes
- `.claude/hooks/advisor-boundary-check.js` — Existing boundary reminder hook pattern
- `.claude/hooks/advisor-install-audit.js` — Existing audit hook baseline and current lack of runtime event recording

### Product framing and research grounding

- `README.md` — High-level definition of Advisor Mode and the executor/advisor split
- `docs/research/claude_code_teams_advisor_research-conversation-20260519.md` — Research grounding for client-side advisor workflows, hooks, and escalation concepts

## Existing Code Insights

### Reusable Assets

- `.claude/settings.json` — Reusable central registration point for PreToolUse/PostToolUse gates
- `.claude/advisor-mode/policy.example.json` — Seed structure for configurable gate policy instead of hard-coding rules into hooks
- `.claude/hooks/advisor-boundary-check.js` — Example of a repo-scoped hook that inspects advisor constraints and emits structured hook context
- `.claude/hooks/advisor-install-audit.js` — Example of a PostToolUse hook emitting structured context that Phase 2 can evolve toward richer gate/audit events
- `.claude/advisor-mode/verdict.schema.json` — Existing schema asset that can anchor structured escalation/verdict packets

### Established Patterns

- Advisor Mode assets are repo-scoped under `.claude/`, so Phase 2 should keep all gate policy/configuration local and versioned there
- Hook wiring is centralized through `.claude/settings.json`, which should remain the integration seam rather than creating a second orchestration entrypoint
- Runtime audit/state is conceptually separate from planning docs, so repeated-failure marks and protected-surface events should flow into runtime state/audit artifacts, not planning files
- Advisor boundary remains read-only from Phase 1, so Phase 2 escalation logic must preserve advisor-as-reviewer rather than let the advisor mutate or execute

### Integration Points

- Extend `.claude/settings.json` matchers/hooks to route high-risk and protected-surface situations into policy evaluation
- Replace the example-only gate policy under `.claude/advisor-mode/` with real trigger rule definitions and protected-surface classes
- Add runtime state/audit handling for normalized failure signatures, escalation markers, decision packets, and disposition tracking
- Reuse existing agent/command/hook surfaces under `.claude/` as protected governance targets in SAFE-04 coverage

## Specific Ideas

- Model Phase 2 around a two-layer control story: host agents own tool execution permissions, while Advisor Mode owns advisor consultation signals and workflow-level decision gates.
- Treat human approval as a structured decision checkpoint with explicit dispositions, not as a raw yes/no wrapper around shell commands.
- Pre-declare future provider-route and credential control surfaces as protected now, so later routing phases inherit the governance boundary instead of inventing it ad hoc.

## Deferred Ideas

None — discussion stayed within phase scope.

---

_Phase: 2-Enforced Trigger Gates_
_Context gathered: 2026-05-21_
