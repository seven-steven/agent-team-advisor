# Advisor Mode Scaffold

Advisor Mode is installed as repo-scoped Claude Code assets. Run this from the repository root:

```bash
node .claude/advisor-mode/init.js
```

Validate Phase 1 local install correctness with:

```bash
node --test .claude/advisor-mode/tests/*.test.js
```

## Created Files

- `.claude/agents/advisor-reviewer.md` — read-only advisor role definition.
- `.claude/agents/executor-guidance.md` — executor authority guidance.
- `.claude/hooks/advisor-boundary-check.js` — boundary reminder hook.
- `.claude/hooks/advisor-install-audit.js` — scaffold audit reminder hook.
- `.claude/settings.json` — project-local hook wiring.
- `.claude/advisor-mode/policy.example.json` — versioned policy example.
- `.claude/advisor-mode/verdict.schema.json` — versioned advisor verdict schema.
- `.advisor/audit` — local runtime audit directory for JSONL events.
- `.advisor/state` — local runtime state directory.

## Phase 1 Boundary

Phase 1 validates local scaffold installation only. Provider routing conformance, high-risk trigger enforcement, budgets, and full telemetry are later phases.
