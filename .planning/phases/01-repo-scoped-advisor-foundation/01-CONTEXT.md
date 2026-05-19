# Phase 1: Repo-Scoped Advisor Foundation - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

## Phase Boundary

This phase only delivers the repo-scoped foundation for Advisor Mode: project-local scaffold assets, advisor/executor role boundaries, settings integration, and baseline runtime directories. It does **not** yet implement high-risk trigger enforcement, provider conformance, or full operational telemetry; those belong to later phases already defined in the roadmap.

## Implementation Decisions

### Asset Layout

- **D-01:** Phase 1 will place versioned advisor-mode assets inside the repository under `.claude/`, not in user-global config or an external control plane.
- **D-02:** The scaffold should use `.claude/agents/` for role definitions, `.claude/hooks/` for enforcement scripts, `.claude/settings.json` for hook wiring, and `.claude/advisor-mode/` for versioned policy/schema examples.
- **D-03:** The implementation should extend the repo’s existing `.claude` layout and script-launch pattern rather than inventing a second configuration surface.

### Advisor Boundary

- **D-04:** The advisor role is structurally read-only in Phase 1 and must not receive mutating tools such as `Bash`, `Write`, `Edit`, or `MultiEdit`.
- **D-05:** The executor remains the only actor allowed to mutate the workspace and run implementation tools.
- **D-06:** Even in the scaffold phase, advisor outputs should be verdict-first and structured around risk, blocking findings, recommended actions, and verification guidance.

### Scaffold Experience

- **D-07:** Phase 1 should ship a single documented scaffold/init flow that writes the baseline agent definitions, hooks, settings integration, policy examples, and runtime directory placeholders.
- **D-08:** The scaffold should be repo-scoped and local-first; it must not require a hosted bootstrap service or opaque remote control plane.
- **D-09:** Phase 1 validation should focus on local install correctness (files present, permissions correct, settings wired) rather than provider or routing conformance.

### Runtime State & Audit Baseline

- **D-10:** Versioned policy and schema examples live under `.claude/advisor-mode/`; runtime state and audit artifacts live in local hidden runtime directories, not in planning docs.
- **D-11:** The initial audit baseline should use append-only local JSONL events sufficient to prove scaffold installation, advisor verdict receipt, and executor follow-up.
- **D-12:** Runtime artifacts should be designed for local inspection first and excluded from normal versioned planning documents unless explicitly promoted later.

### Claude's Discretion

- The planner may choose exact scaffold command names and exact file names under `.claude/advisor-mode/`, as long as the repo-scoped layout, read-only advisor boundary, and local-first runtime split above remain intact.
- The planner may choose whether runtime audit/state defaults are split across `.claude/advisor-state/`, `.advisor/`, or an equivalent hidden project-local runtime directory, as long as versioned policy stays separate from runtime artifacts.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and locked direction

- `.planning/PROJECT.md` — Product goal, hard constraints, and locked project-level decisions for client-side Advisor Mode
- `.planning/REQUIREMENTS.md` — Phase-mapped v1 requirements; Phase 1 covers AGNT-01, AGNT-02, AGNT-03, SETP-01
- `.planning/ROADMAP.md` — Phase goal, dependency order, and success criteria for Phase 1
- `.planning/STATE.md` — Current project position and active focus

### Research and concept grounding

- `.planning/research/SUMMARY.md` — Consolidated stack, architecture, feature, pitfall, and roadmap implications
- `README.md` — High-level definition of Advisor Mode and its executor/advisor split
- `docs/research/claude_code_teams_advisor_research-conversation-20260519.md` — Detailed product research and reference architecture for client-side advisor workflows

### Existing repository runtime patterns

- `.claude/settings.json` — Existing project-level hook registration and script wiring pattern that the scaffold should extend
- `.claude/package.json` — Existing Node/CommonJS runtime convention for local Claude-related scripts

## Existing Code Insights

### Reusable Assets

- `.claude/settings.json` — Reusable central hook-registration pattern; new Phase 1 scaffold should plug into this file instead of inventing a second settings entrypoint
- `.claude/hooks/` — Existing project hook directory and script naming conventions provide the correct place for advisor-mode hook assets
- `.claude/package.json` — Existing CommonJS runtime marker can support local Node-based hook and scaffold scripts without adding a new runtime convention

### Established Patterns

- Project-scoped Claude automation already lives under `.claude/`, so Advisor Mode should follow the same repo-local convention
- Hook orchestration already mixes Node and Bash scripts launched from `.claude/settings.json`; Phase 1 should preserve that wiring style
- Planning and phase artifacts already live under `.planning/` and `.planning/phases/`; runtime audit/state should stay separate from those planning records

### Integration Points

- Add advisor/executor role assets under `.claude/agents/`
- Wire scaffolded hooks through `.claude/settings.json`
- Place versioned advisor policy/schema examples under `.claude/advisor-mode/`
- Create hidden runtime state/audit directories that later phases can extend without polluting planning docs

## Specific Ideas

- Keep the reference story aligned with the research baseline of GLM as executor and GPT-5.5 as advisor, but implement Phase 1 assets in alias-based terms so provider names stay swappable until Phase 4.
- Match the repo’s existing local-first posture: no hosted control plane, no server-side advisor dependency, and no advisor write permissions.
- Treat Phase 1 as the place to make the foundation reproducible and reviewable; richer triggers, routing, and budgets come later.

## Deferred Ideas

None — discussion stayed within phase scope.

---

_Phase: 1-Repo-Scoped Advisor Foundation_
_Context gathered: 2026-05-19_
