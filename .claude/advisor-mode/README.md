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

## Phase 2 Gate Model

Phase 2 adds policy-driven advisor and human approval gates on top of the scaffold.

### Host permissions vs workflow gates

- Claude Code host permissions still decide whether tools may execute; Advisor Mode does not replace the host permission layer.
- Claude Code host enforcement uses supported `PreToolUse` semantics such as `hookSpecificOutput.permissionDecision` and documented exit-code behavior.
- Advisor Mode workflow gates use local artifacts and state fields such as request paths, recommendation paths, disposition paths, `workflowGateStatus`, and `retryRequired`.
- Unsupported custom hook metadata is not relied on as a host-enforced blocking protocol.

### High-risk advisor consultation

1. A high-risk `Bash`, `Edit`, `Write`, or `MultiEdit` event is classified by repo policy.
2. The hook writes `.advisor/consultations/requests/{correlationKey}.json`.
3. The first risky attempt is host-blocked.
4. The executor triggers the read-only `advisor-reviewer` using the request artifact and persists `.advisor/consultations/recommendations/{correlationKey}.json`.
5. The user or executor explicitly retries the blocked action; only then may the hook allow the action when the recommendation artifact validates.

### Human approval

- Critical classes are `irreversible`, `security-boundary`, `shared-production`, and `governance-configuration`.
- Human approval packets include trigger reason, decision summary, risk level, options, non-null advisor recommendation, expected consequences, suggested verification points, `correlationKey`, and `dispositionPath`.
- Human outcomes are persisted as `.advisor/decisions/dispositions/{correlationKey}.json` with `approve`, `reject`, `revise`, or `defer`.
- Missing disposition keeps the workflow path blocked locally.
- Completion requires explicit retry after a valid disposition artifact exists.

### Repeated failures and protected surfaces

- Repeated failures are normalized and escalate at threshold 2 through `PostToolUse` state tracking.
- Protected surfaces are path-class-first policy entries for advisor policy, hooks, settings, agents, commands, provider-route controls, and credential-control files.
- Protected events carry the `protected-surface.review` audit label.

### Runtime artifacts

Generated runtime artifacts stay under ignored `.advisor/` paths:

- `.advisor/consultations/requests/*.json`
- `.advisor/consultations/recommendations/*.json`
- `.advisor/decisions/dispositions/*.json`
- `.advisor/state/*.json`
- `.advisor/audit/*.jsonl`

### Validation

Run:

```bash
node --test .claude/advisor-mode/tests/*.test.js
```

## Phase 3 Final Review

Phase 3 closes non-trivial work with a guarded completion flow that keeps advisor review read-only and executor decisions explicit.

1. The executor builds a minimized final-review context packet from changed files, relevant diff excerpts, relevant errors, verification summary, and explicit questions. Full transcript forwarding is not the default.
2. The read-only advisor returns a fresh structured final verdict for the current completion state.
3. The executor records verification evidence for the guarded task before completion.
4. For `CONCERNS`, `FAIL`, or `BLOCKED` verdicts, the executor records per-recommendation follow-up decisions before completion can proceed.
5. Completion is allowed only when `.claude/hooks/advisor-final-review-gate.js` sees fresh matching state for the current verdict, verification evidence, changed files, fingerprint, and any required executor decision.

### Phase 3 runtime artifacts

Generated Phase 3 artifacts stay under ignored local `.advisor/` paths:

- `.advisor/evidence/verification/*.json` — immutable verification evidence snapshots for guarded work.
- `.advisor/decisions/executor/*.json` — executor accept/reject/defer rationale for advisor recommendations.
- `.advisor/state/final-review.json` — current final-review freshness binding checked by the Stop hook.
- `.advisor/audit/events.jsonl` — append-only runtime events for evidence and executor decision recording.

### Phase 3 validation

Run the full advisor-mode regression suite:

```bash
node --test .claude/advisor-mode/tests/*.test.js
```

### Deferred phase boundaries

Provider routing and conformance validation remain Phase 4 scope. Budgets, rollback, and broader audit exploration remain Phase 5 scope.
