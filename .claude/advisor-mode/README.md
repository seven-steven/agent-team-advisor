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

## Phase 4 Provider Routing and Conformance

Phase 4 keeps routing thin and audit-first: workflow code uses semantic aliases, while provider route files map those aliases to concrete provider/model targets for operator inspection.

### Route file

- `.claude/advisor-mode/provider-routes.example.json` declares `sonnet`, `opus`, and `haiku` route defaults.
- Each route records provider ID, model ID, `endpointRef`, credential environment variable name, and required conformance checks.
- Route files store environment variable names only. Do not commit auth token values, headers, or request bodies.

### Conformance command

Run targeted local conformance before trusting advisor-critical routes:

```bash
ANTHROPIC_BASE_URL=https://openrouter.ai/api \
ANTHROPIC_AUTH_TOKEN=<operator-owned-token> \
node .claude/advisor-mode/provider-conformance.js --alias opus --alias sonnet
```

For deterministic local tests without a live gateway, use the mocked mode covered by the test suite:

```bash
node .claude/advisor-mode/provider-conformance.js --mock pass --alias opus
```

The command validates exactly the advisor-critical Anthropic-compatible behaviors required by Phase 4: base message response shape, streaming event sequence, tool-use response shape, usage fields, and error shape. Unsupported or malformed behavior records `status: "fail"` and exits non-zero; there is no silent advisor-critical fallback.

### Conformance artifacts

Successful and failed runs write sanitized operator evidence:

- `.advisor/state/provider-conformance.json` — latest route-aware conformance artifact.
- `.advisor/audit/events.jsonl` — append-only `provider_conformance.completed` audit event.

Artifacts include requested alias, resolved provider/model, endpoint reference, per-check status, and timestamps. They omit auth headers, bearer tokens, full request bodies, prompts, and credential values.

### Live verification checkpoint

Before enabling a live provider route, confirm current gateway documentation and operator configuration for:

1. Anthropic-compatible Messages API base request/response shape.
2. Streaming event shape.
3. Tool-use request/response shape.
4. Usage metadata fields.
5. Representative Anthropic-like error response shape.
6. `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` or provider-specific equivalent environment variables.

Phase 4 stops at routing and targeted conformance. Budget controls, rollback controls, and broader install doctor workflows remain Phase 5 scope.
