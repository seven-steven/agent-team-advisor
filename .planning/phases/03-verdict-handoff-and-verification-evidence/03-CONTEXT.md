# Phase 3: Verdict Handoff and Verification Evidence - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the completion-decision handoff contract around advisor review: a fresh final review gate for non-trivial work, a structured advisor verdict, a separate executor follow-up rationale record, a minimized advisor context packet, and a verification evidence artifact. It does not expand into provider routing, budget policy, or broader audit/rollback controls from later phases.

</domain>

<decisions>
## Implementation Decisions

### Final Review Trigger

- **D-01:** Require a fresh advisor final review before a non-trivial task is marked complete.
- **D-02:** Define non-trivial work primarily through explicit task/workflow state rather than heuristics.
- **D-03:** Do not reuse prior advisor consultations for completion; completion always requires a new final verdict against the latest state.
- **D-04:** Only `PASS` allows direct completion. `CONCERNS`, `FAIL`, and `BLOCKED` require explicit executor follow-up decisions rather than automatic completion.

### Minimized Context Packet

- **D-05:** The default advisor handoff packet is a compact four-part bundle: changed files, relevant diff excerpts, relevant errors, and explicit questions.
- **D-06:** Code context in the packet should default to relevant diff hunks plus short supporting excerpts, not full files.
- **D-07:** The packet must include an explicit question list from the executor; advisor verdicts should answer those questions rather than infer intent.
- **D-08:** If the minimal packet is insufficient, the advisor should explicitly request additional context and the executor should resend an expanded packet; do not silently broaden the default packet.

### Executor Follow-Up Rationale

- **D-09:** Record executor follow-up in a dedicated `executor-decision` artifact rather than mutating the advisor verdict artifact.
- **D-10:** Record disposition per recommended action, not only once per overall verdict.
- **D-11:** Each per-recommendation entry must include disposition, a short rationale, linked evidence references, and a timestamp.
- **D-12:** Write the executor-decision artifact immediately after the executor processes the final verdict, before any completion decision proceeds.

### Verification Evidence

- **D-13:** Use one verification-evidence artifact per guarded task, with command-level entries plus a package-level summary.
- **D-14:** Each command entry must include at least the command, exit status, concise result summary, and timestamp; package-level fields should carry changed files and residual risks.
- **D-15:** Include verification commands only, such as tests, type checks, lint, smoke checks, and other decisive assertions; exclude general development commands.
- **D-16:** Treat each verification-evidence artifact as an immutable snapshot tied to a specific final-review/completion decision. A later review round produces a new artifact.

### Claude's Discretion

None — the primary implementation decisions for this phase were explicitly locked during discussion.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements

- `.planning/ROADMAP.md` — defines Phase 3 goal, dependency boundary, and success criteria.
- `.planning/REQUIREMENTS.md` — maps the governing requirements for this phase, including `GATE-03`, `VERD-01`, `VERD-02`, `AUDT-02`, and `SAFE-02`.
- `.planning/PROJECT.md` — provides the project-level constraints for pure client-side Advisor Mode and the read-only advisor boundary.
- `.planning/STATE.md` — current planning state for continuity.

### Prior locked decisions

- `.planning/phases/01-repo-scoped-advisor-foundation/01-CONTEXT.md` — locks repo-scoped assets, read-only advisor boundaries, and the executor-only mutation model.
- `.planning/phases/02-enforced-trigger-gates/02-CONTEXT.md` — locks the existing gate/disposition chain that Phase 3 must extend rather than replace.
- `.planning/phases/02-enforced-trigger-gates/02-RESEARCH.md` — captures the upstream gate semantics and research context relevant to the final-review chain.
- `.planning/phases/02-enforced-trigger-gates/02-PATTERNS.md` — maps existing implementation patterns and established seams from Phase 2.

### Runtime assets and integration seams

- `.claude/settings.json` — established hook wiring surface; new final-review behavior should integrate here rather than through a new control surface.
- `.claude/hooks/advisor-gate.js` — primary integration seam for final-review gating, recommendation validation, and retry/disposition flow.
- `.claude/hooks/advisor-failure-tracker.js` — existing append-only evidence/audit writing pattern that can inform verification evidence handling.
- `.claude/advisor-mode/verdict.schema.json` — current structured advisor verdict contract that Phase 3 should extend rather than replace wholesale.
- `.claude/agents/advisor-reviewer.md` — current read-only advisor output contract.
- `.claude/advisor-mode/README.md` — documents runtime artifact conventions under `.advisor/`.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `.claude/hooks/advisor-gate.js`: already handles structured consultation requests, recommendation artifacts, retry expectations, and validation gates.
- `.claude/hooks/advisor-failure-tracker.js`: already writes concise JSONL/state artifacts in an append-only style suitable for evidence-oriented extensions.
- `.claude/advisor-mode/verdict.schema.json`: already expresses verdict-first fields such as status, risk, confidence, blocking findings, recommended actions, and verification guidance.
- `.claude/agents/advisor-reviewer.md`: already reinforces the advisor's read-only responsibility boundary and structured review output.

### Established Patterns

- Advisor outputs stay structured and verdict-first; executor remains the only actor that mutates files or performs implementation actions.
- Runtime state and audit artifacts live under hidden local runtime directories rather than mixed into planning documents.
- Gate behavior is enforced through repo-scoped Claude Code hooks and configuration, not a separate server-side orchestrator.
- Existing approval/disposition flows already separate recommendation production from executor/human follow-up; Phase 3 should preserve that boundary.

### Integration Points

- Extend the existing gate chain in `.claude/hooks/advisor-gate.js` to add the completion-time final-review trigger.
- Extend or complement `.claude/advisor-mode/verdict.schema.json` for final verdict and downstream executor-decision linkage.
- Reuse `.advisor/` runtime artifact conventions and append-only audit patterns for verification evidence storage.
- Keep all new workflow enforcement wired through `.claude/settings.json`.

</code_context>

<specifics>
## Specific Ideas

No specific product-style references were introduced during discussion. Standard approaches are acceptable as long as they preserve the locked decision boundaries above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 3-Verdict Handoff and Verification Evidence_
_Context gathered: 2026-05-27_
