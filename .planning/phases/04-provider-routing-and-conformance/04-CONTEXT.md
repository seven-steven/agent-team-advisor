# Phase 4: Provider Routing and Conformance - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the provider-routing layer for Advisor Mode: Claude semantic aliases such as `sonnet`, `opus`, and `haiku` must map to concrete third-party provider/model targets through a swappable routing surface, and the selected gateway must be proven safe enough for advisor-critical flows through targeted Anthropic-compatible conformance checks. It also defines how actual provider/model resolution becomes inspectable for audit and operator debugging. It does **not** redefine gate logic, verdict flow, or broader budget/rollback policy from later phases.

</domain>

<decisions>
## Implementation Decisions

### Provider Routing Responsibility

- **D-01:** Phase 4 provider routing is a thin mapping layer from Claude semantic aliases to concrete `provider + model` targets plus minimal route metadata needed for conformance and audit.
- **D-02:** Provider routing must **not** absorb advisor gates, verdict handling, or broader workflow control logic; those stay in the existing Advisor Mode runtime chain.

### Hook and Control Surface

- **D-03:** Prefer plugin/skill-owned hook assets as the primary control surface so the integration feels self-contained and avoids unnecessary pollution of user configuration.
- **D-04:** Repo-local configuration remains an allowed fallback only where project-level override or explicit versioned auditability is needed.

### Reference Route Expression

- **D-05:** Phase 4 should support declarative default routes rather than hard-coded fixed routes or example-only placeholders.
- **D-06:** The reference route should ship with a default mapping story such as `sonnet → GLM` and `opus → GPT-5.5`, but planners should preserve workflow independence so maintainers can swap concrete targets without changing executor/advisor logic.

### Conformance Validation Scope

- **D-07:** Conformance should validate the critical Anthropic-compatible behaviors needed for advisor-critical flows: base message requests, streaming, tool-use behavior, usage fields, error shape, and other directly depended-on runtime semantics.
- **D-08:** Phase 4 should avoid turning conformance into a full exhaustive protocol certification pass; the target is “safe for advisor-critical flows,” not total protocol completeness.

### Provider / Model Visibility

- **D-09:** The actual resolved provider and model for executor/advisor calls should be recorded in runtime artifacts and audit surfaces by default.
- **D-10:** That visibility should be audit-first and operator-facing, not necessarily pushed into every normal user-facing output by default.

### Claude's Discretion

- The planner may choose the exact configuration format, route metadata shape, and conformance command structure as long as the thin-routing boundary, declarative defaults, audit visibility, and plugin-first control surface remain intact.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirement mapping

- `.planning/ROADMAP.md` — defines Phase 4 goal, dependency boundary, and success criteria.
- `.planning/REQUIREMENTS.md` — maps the governing requirements for this phase, including `ROUT-01`, `ROUT-02`, `ROUT-03`, and `ROUT-04`.
- `.planning/PROJECT.md` — provides the project-level client-side, read-only-advisor, and auditability constraints that routing must preserve.
- `.planning/STATE.md` — current planning state and milestone continuity.

### Prior locked decisions

- `.planning/phases/01-repo-scoped-advisor-foundation/01-CONTEXT.md` — locks repo-scoped Advisor Mode assets, read-only advisor boundaries, and alias-oriented foundation assumptions.
- `.planning/phases/02-enforced-trigger-gates/02-CONTEXT.md` — locks provider routes and credential controls as protected governance surfaces within the existing gate/disposition chain.
- `.planning/phases/03-verdict-handoff-and-verification-evidence/03-CONTEXT.md` — locks the final-review/verdict/evidence contract that provider routing must support rather than replace.

### Existing runtime and configuration surfaces

- `.claude/settings.json` — current Claude Code hook wiring and integration seam.
- `.claude/advisor-mode/README.md` — current phase boundary notes and runtime artifact conventions.
- `.claude/advisor-mode/policy.example.json` — existing protected-surface and provider-route policy definitions that Phase 4 must extend.
- `.claude/hooks/advisor-gate.js` — current gate/policy evaluator showing the active protected-surface and route-related integration seam.
- `.claude/agents/advisor-reviewer.md` — current read-only advisor contract that routing changes must continue to respect.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `.claude/settings.json` — reusable central registration point for wiring route-aware hooks and runtime integration.
- `.claude/advisor-mode/policy.example.json` — already names provider-route and credential-control surfaces explicitly, so it is the natural seed for route configuration policy.
- `.claude/hooks/advisor-gate.js` — already classifies protected surfaces and evaluates workflow gates, making it the main integration seam for route-related governance behavior.
- `.claude/advisor-mode/README.md` — already documents runtime artifact locations and phase boundaries that Phase 4 must update instead of bypassing.

### Established Patterns

- Advisor Mode keeps workflow control in repo-scoped runtime assets while preserving a strict read-only advisor / executor-only mutation boundary.
- Governance-sensitive configuration is treated as a protected surface and routed through the existing consultation/disposition chain.
- Runtime evidence and observability live in hidden local artifacts under `.advisor/`, separate from planning documents.
- Alias-oriented thinking is already established in the product framing, so Phase 4 should preserve semantic alias routing instead of baking workflow behavior against concrete model names.

### Integration Points

- Extend the provider-route control surface under `.claude/advisor-mode/` (or plugin-owned equivalent with explicit project override path).
- Keep route-related governance tied into `.claude/hooks/advisor-gate.js` and `.claude/settings.json` rather than creating a second workflow-control system.
- Add conformance validation as a maintainers’ runtime command or doctor-style surface that proves Anthropic-compatible gateway behavior before advisor-critical enablement.
- Emit resolved provider/model metadata into existing runtime audit/evidence paths so later audit/budget/operator phases can build on the same artifacts.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly prefers a plugin/skill-owned hook model where possible, because it is cleaner and less intrusive than forcing users to hand-manage their own config surfaces.
- The route layer should remain swappable: default mappings are useful, but changing the provider/model target must not require changing workflow logic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 4-Provider Routing and Conformance_
_Context gathered: 2026-05-27_
