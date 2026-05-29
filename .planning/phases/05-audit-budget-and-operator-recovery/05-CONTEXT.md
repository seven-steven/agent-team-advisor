# Phase 5: Audit, Budget, and Operator Recovery - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the operator-hardening layer for Advisor Mode: users can inspect correlated runtime audit history, enforce hard advisor usage limits, validate installation and runtime health through a doctor surface, and recover safely through kill-switch or warning-only controls. It does not redefine advisor verdict structure, provider routing semantics, or the existing gate/disposition chain from earlier phases.

</domain>

<decisions>
## Implementation Decisions

### Audit trail shape

- **D-01:** Audit must provide two first-class views: an append-only raw event stream and correlated task/session views.
- **D-02:** Task and session are both first-class correlation keys; runtime events should carry both whenever available rather than forcing one as the sole primary axis.
- **D-03:** When one correlation key is unavailable at runtime, artifacts may degrade gracefully to the available key, but the model for this phase is dual-key correlation by default.

### Budget limits

- **D-04:** Budget enforcement must use triple hard caps: advisor call count, advisor token usage, and advisor latency.
- **D-05:** These limits should be enforceable at task or session scope rather than only as loose global observation.
- **D-06:** Budgeting here is about bounded operations, not broadening advisor context; the minimized context packet from Phase 3 remains the default upstream constraint.

### Over-limit behavior

- **D-07:** When any budget dimension exceeds its cap, the system should enter graceful degraded mode instead of fully disabling the workflow.
- **D-08:** In degraded mode, keep the final review gate and critical human-approval gates mandatory.
- **D-09:** Other advisor-enforced paths may downgrade to warning + audit while over-limit, so operators preserve continuity without silently dropping observability.

### Operator recovery controls

- **D-10:** Recovery controls should be layered: a global mode switch plus independently controllable capability classes rather than a single all-or-nothing toggle.
- **D-11:** Supported operator modes must include at least enforce, warning-only, and disabled/kill-switch behavior.
- **D-12:** Recovery controls are operational governance surfaces and must continue to respect the protected-surface model from Phase 2.

### Doctor validation

- **D-13:** Phase 5 should provide a deep doctor surface rather than a file-presence-only install check.
- **D-14:** Doctor must validate installation, hook wiring, advisor permission shape, provider route health, key schema/runtime paths, and active operational configuration.
- **D-15:** Doctor should also run targeted smoke-style runtime checks where practical, rather than stopping at static configuration inspection.
- **D-16:** Doctor output should be operator-facing and actionable, with clear pass/fail status and repair guidance per check.

### Claude's Discretion

- The planner may choose the exact artifact schemas, command UX, degraded-mode state representation, and audit index format as long as the dual-view audit model, dual correlation keys, triple hard caps, graceful degradation boundary, layered recovery controls, and deep doctor intent remain intact.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirement mapping

- `.planning/ROADMAP.md` — defines the Phase 5 goal, dependency boundary, and success criteria.
- `.planning/REQUIREMENTS.md` — maps the governing requirements for this phase, including `AUDT-01`, `AUDT-03`, `SAFE-01`, `SAFE-03`, and `SETP-02`.
- `.planning/PROJECT.md` — provides the project-level client-side, read-only-advisor, auditability, and rollback constraints.
- `.planning/STATE.md` — current planning state and continuity context.

### Prior locked decisions

- `.planning/phases/02-enforced-trigger-gates/02-CONTEXT.md` — locks the existing gate/disposition chain, protected-surface rules, and human approval boundary that degraded/recovery behavior must preserve.
- `.planning/phases/03-verdict-handoff-and-verification-evidence/03-CONTEXT.md` — locks minimized advisor packets, verification evidence behavior, and final-review semantics that Phase 5 must build on.
- `.planning/phases/04-provider-routing-and-conformance/04-CONTEXT.md` — locks runtime provider/model observability expectations and the audit-first route visibility that Phase 5 should extend.

### Existing runtime assets and integration seams

- `.claude/settings.json` — current hook wiring surface for any doctor, budget, or recovery integration.
- `.claude/advisor-mode/README.md` — current phase boundaries, runtime artifact conventions, and operator validation commands.
- `.claude/advisor-mode/runtime-paths.js` — current runtime root/path derivation that Phase 5 audit, budget, and doctor surfaces should reuse.
- `.claude/hooks/advisor-gate.js` — current gate evaluator and protected-surface enforcement seam for degraded-mode and operational controls.
- `.claude/hooks/advisor-final-review-gate.js` — current final-review enforcement seam that degraded mode must continue to preserve.
- `.claude/hooks/executor-route-audit.js` — current provider-route audit event pattern relevant to correlated audit history.
- `.claude/advisor-mode/provider-conformance.js` — existing validation/smoke-check command surface that Phase 5 doctor flows can extend rather than replace.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `.claude/advisor-mode/runtime-paths.js` — central runtime-root and artifact-path helper suited for new audit, budget, and doctor artifacts.
- `.claude/hooks/advisor-gate.js` — already persists structured consultation/runtime state and is the natural seam for budget-aware degraded behavior.
- `.claude/hooks/advisor-final-review-gate.js` — already enforces a completion-time gate, making it the must-preserve hard gate in degraded mode.
- `.claude/hooks/executor-route-audit.js` — already records structured route events with correlation identifiers and append-only audit writes.
- `.claude/advisor-mode/provider-conformance.js` — already implements targeted runtime validation and append-only audit/state writing patterns reusable for a doctor command.

### Established Patterns

- Runtime evidence and observability live in hidden local runtime artifacts, not in planning docs.
- Audit/state writes are append-only or snapshot-plus-append patterns rather than in-place mutable histories.
- Governance-sensitive controls flow through repo-scoped hook/config surfaces and protected-surface rules.
- Provider/model observability is audit-first and operator-facing, not pushed into every normal user-facing interaction.

### Integration Points

- Extend `.claude/hooks/advisor-gate.js` with budget accounting, over-limit detection, and degraded-mode transitions.
- Preserve `.claude/hooks/advisor-final-review-gate.js` and critical human approval paths as mandatory controls during degradation.
- Reuse `.advisor/` runtime artifact conventions for audit indexes, budget state, and operator recovery state.
- Extend the existing `.claude/advisor-mode/` command/runtime surface with doctor and rollback/recovery controls rather than creating a separate subsystem.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants both raw event auditability and operator-friendly correlated views, not a single canonical presentation.
- The user prefers graceful degradation over total hard-stop when budget caps are exceeded, but still wants final review and critical human approval preserved.
- The user wants doctor to go beyond static install checks and actively run targeted health/smoke validation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 5-Audit, Budget, and Operator Recovery_
_Context gathered: 2026-05-29_
