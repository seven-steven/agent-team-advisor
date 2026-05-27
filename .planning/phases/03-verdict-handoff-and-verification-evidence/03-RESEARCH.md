# Phase 3: Verdict Handoff and Verification Evidence - Research

**Researched:** 2026-05-27
**Domain:** Claude Code hook-based final review, structured advisor verdicts, minimized context packets, executor dispositions, and verification evidence capture
**Confidence:** MEDIUM-HIGH

## Correction Note

This research is authoritative only when read **together with** `.planning/phases/03-verdict-handoff-and-verification-evidence/03-CONTEXT.md`, which is present in the main repository and contains the locked Phase 3 decisions. An earlier worktree-local research run incorrectly reported that `03-CONTEXT.md` was missing; that claim is false for the main repo and must be ignored.

For planning precedence, use:

1. `03-CONTEXT.md`
2. this `03-RESEARCH.md`
3. Phase 2 context/research/pattern artifacts
4. current `.claude/` runtime assets

Any assumption in this document that conflicts with locked decisions `D-01` through `D-16` in `03-CONTEXT.md` is overridden by `03-CONTEXT.md`.

## User Constraints

### Locked Decisions

Phase 03 has explicit locked decisions in `03-CONTEXT.md` and they must drive planning. The most important ones are:

- Fresh advisor final review is required before non-trivial completion (`D-01`, `D-03`, `D-04`).
- Non-trivial work should be determined from explicit workflow/task state, not fuzzy heuristics (`D-02`).
- Default advisor handoff is a minimized four-part packet: changed files, relevant diff excerpts, relevant errors, and explicit questions (`D-05` to `D-08`).
- Executor follow-up must be recorded in a separate `executor-decision` artifact, per recommendation, with rationale/evidence/timestamp (`D-09` to `D-12`).
- Verification evidence must be captured per guarded task as an immutable snapshot with command-level entries and package-level summary (`D-13` to `D-16`).

Phase 03 is also constrained by roadmap and requirements: `GATE-03`, `VERD-01`, `VERD-02`, `AUDT-02`, and `SAFE-02`. It must extend Phase 02 gate/disposition chains rather than replace them.

### Claude's Discretion

The main architecture is not discretionary; the locked decisions define the contract. Planner discretion is limited to:

- exact file names
- exact JSON field names where not already fixed by existing schema/contracts
- whether final-review enforcement uses `Stop`/`SubagentStop` hooks directly or an explicit local finalize command as fallback
- exact test file layout

### Deferred Ideas (OUT OF SCOPE)

Do not expand this phase into:

- provider routing or conformance validation (Phase 04)
- global audit exploration, session correlation UX, budgets, rollback, or doctor flows (Phase 05)
- advisor write/execute authority
- full transcript forwarding by default

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                | Research Support                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GATE-03 | User can require a fresh advisor final review before a non-trivial task is marked complete                                                                 | Implement a completion-stage gate tied to current work/evidence freshness. Prefer Claude Code lifecycle hook wiring if verified; otherwise use an explicit local finalize command as deterministic fallback. |
| VERD-01 | User can receive a structured advisor verdict containing risk level, confidence, blocking findings, recommended next actions, and a validation checklist   | Extend existing `.claude/advisor-mode/verdict.schema.json` rather than replace it. Keep verdict schema-first and validation-first.                                                                           |
| VERD-02 | User can see whether the executor accepted, rejected, or deferred each advisor recommendation, with recorded rationale                                     | Add a separate executor-decision contract keyed per recommendation with `accepted`, `rejected`, or `deferred` plus rationale/evidence/timestamp.                                                             |
| AUDT-02 | User can capture verification evidence for guarded work, including commands run, exit status, concise result summaries, changed files, and residual risks  | Add a verification-evidence artifact under `.advisor/` conventions with command entries and summary fields.                                                                                                  |
| SAFE-02 | User can send advisors a minimized context packet based on relevant diffs, errors, files, and explicit questions instead of the full transcript by default | Define a context-packet schema/builder that whitelists compact fields and excludes full transcript by default.                                                                                               |

</phase_requirements>

## Project Constraints (from CLAUDE.md / PROJECT.md)

- Keep the design pure client-side; do not depend on `server_tool_use` or `advisor_20260301`.
- Stay within Claude Code / Claude Code Teams semantics using hooks, subagents, local files, and local tools.
- Advisor remains read-only; executor retains mutation and command authority.
- Prefer current repo patterns: Node/CommonJS, JSON schema contracts, `.advisor/` runtime artifacts, and repo-local `.claude/` assets.
- Stay tightly in Phase 03 scope; do not pull in Phase 04/05 work.

## Summary

Phase 03 is a **contract-and-evidence** phase. The planner should standardize the boundary between executor, advisor, and user:

1. executor builds a minimized context packet
2. advisor returns a schema-valid structured verdict
3. executor records per-recommendation dispositions with rationale/evidence
4. executor captures concise verification evidence
5. non-trivial completion requires a fresh final review tied to the latest state

The existing project already has the right substrate: repo-local `.claude/` assets, read-only advisor boundary validation, `.claude/settings.json` hook wiring, `.advisor/` runtime paths, and `node:test` coverage. Phase 03 should extend these assets rather than introduce new dependencies or new infrastructure.

**Primary recommendation:** implement a zero-new-dependency Node/CommonJS verdict handoff layer around existing Advisor Mode assets, with versioned schemas, freshness/correlation rules, and tests that preserve the locked Phase 3 decisions.

## Architectural Responsibility Map

| Capability                          | Primary Tier                    | Secondary Tier                    | Rationale                                                                                          |
| ----------------------------------- | ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Completion final-review gate        | Claude Code hook/workflow layer | Local runtime state               | Completion gating belongs at lifecycle/workflow time and must key off fresh state/evidence.        |
| Minimized context packet            | Local packet builder            | Executor workflow                 | Executor has access to changed files, diffs, errors, verification summary, and explicit questions. |
| Structured advisor verdict          | Advisor output contract         | JSON Schema validation            | Existing verdict schema already provides the base contract.                                        |
| Executor recommendation disposition | Executor workflow/runtime state | Audit/evidence artifacts          | Advisor stays read-only; executor owns accept/reject/defer decisions.                              |
| Verification evidence capture       | Local runtime filesystem        | Executor command/evidence wrapper | Evidence is local, concise, and reproducible.                                                      |
| User completion decision packet     | Local CLI/command output        | Runtime artifacts                 | User should decide from concise structured output, not a full transcript.                          |

## Standard Stack

### Core

| Library / Tool                | Purpose                                                          | Why Standard                                                                                       |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Claude Code hooks             | Completion-stage gate and subagent/verdict lifecycle integration | Existing project already integrates via `.claude/settings.json`; Phase 03 should extend this seam. |
| Claude Code project subagents | Read-only advisor final review                                   | Existing scaffold already defines a read-only advisor role.                                        |
| Node.js                       | Hook scripts, schema checks, packet/evidence builders, tests     | Existing hooks and tests are CommonJS Node scripts.                                                |
| Node built-in test runner     | Unit/integration tests without external dependencies             | Existing `.claude/advisor-mode/tests/*.test.js` already use `node:test`.                           |
| JSON Schema Draft 2020-12     | Verdict/context/evidence contract definitions                    | Existing verdict schema already uses it.                                                           |

### Supporting

| Library / Tool                | Purpose                             | When to Use                                                                                                 |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Git                           | Changed-file and diff evidence      | Use for changed-file inventory and relevant diff snippets in minimized context packets.                     |
| `.advisor/audit/events.jsonl` | Append-only runtime evidence/events | Use for advisor verdict received, executor disposition recorded, and verification evidence captured events. |
| `.advisor/state/*.json`       | Freshness and correlation state     | Use to track final-review freshness, correlation IDs, and pending dispositions.                             |

### Alternatives Considered

| Instead of                        | Could Use               | Tradeoff                                                                                                        |
| --------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Zero-new-dependency Node/CommonJS | TypeScript + Zod        | Zod improves ergonomics, but Phase 03 can extend existing JSON schema + Node patterns without new package risk. |
| JSONL + small JSON state          | SQLite                  | SQLite helps querying later, but broader audit UX belongs to Phase 05.                                          |
| Claude Code lifecycle hooks       | Custom watcher/daemon   | Hooks are already the project integration seam; daemons add operational complexity.                             |
| Minimized packet builder          | Full transcript forward | Full transcript forwarding violates `SAFE-02` by default.                                                       |

## Architecture Patterns

### Pattern 1: Schema-first advisor verdict

Treat the advisor response as a verdict-first structured contract. Existing schema fields already cover `status`, `risk`, `confidence`, `blocking_findings`, `recommended_actions`, and `verification_guidance`; Phase 03 should extend or refine this contract without replacing it wholesale.

### Pattern 2: Minimized context packet by default

Build an explicit advisor input packet from:

- task summary / trigger reason
- changed files
- relevant diff excerpts
- relevant errors
- concise verification summary
- explicit questions

Do **not** send the full transcript by default. If the packet is insufficient, the advisor should explicitly request more context and the executor should resend an expanded packet.

### Pattern 3: Recommendation-level executor disposition

Store a disposition per advisor recommendation, not only one global executor response. Each entry should include:

- recommendation identifier
- disposition: `accepted` / `rejected` / `deferred`
- short rationale
- evidence references
- timestamp

### Pattern 4: Verification evidence is factual, concise, and immutable

Verification evidence should capture:

- verification commands only
- exit status
- concise result summary
- changed files
- residual risks
- timestamp

Keep one verification-evidence artifact per guarded task/final-review round. A later review round should produce a new artifact instead of mutating the old one.

## Recommended Project Structure

```text
.claude/
├── advisor-mode/
│   ├── verdict.schema.json
│   ├── context-packet.schema.json
│   ├── disposition.schema.json
│   ├── verification-evidence.schema.json
│   ├── final-review.js
│   └── tests/
│       ├── final-review-gate.test.js
│       ├── verdict-handoff.test.js
│       ├── disposition.test.js
│       ├── verification-evidence.test.js
│       └── context-packet.test.js
├── hooks/
│   └── advisor-final-review-gate.js
└── settings.json

.advisor/
├── audit/events.jsonl
└── state/final-review.json
```

Filenames above are recommended defaults, not locked names.

## Anti-Patterns to Avoid

- Reusing stale advisor verdicts for completion.
- Modeling executor follow-up as one global “accepted advisor feedback” flag.
- Sending full transcript/raw logs by default.
- Letting advisor execute verification or mutate workspace state.
- Replacing `.claude/settings.json` instead of extending it idempotently.
- Expanding into provider routing, budgets, rollback, or audit dashboard work.

## Common Pitfalls

### Pitfall 1: Final review gate accepts stale evidence

A verdict exists, but files changed afterward. Avoid this by binding final review to correlation key, evidence IDs or changed-file fingerprint, and timestamp.

### Pitfall 2: Validation checklist is too vague

Generic “run tests” guidance is not enough for completion decisions. Require checklist items to be concrete and verifiable.

### Pitfall 3: Executor disposition is too coarse

A verdict-level disposition hides which recommendation was actually rejected. Use recommendation-level entries.

### Pitfall 4: Context packets leak too much

Raw transcripts, secrets, or irrelevant logs undermine `SAFE-02`. Use a strict whitelist and concise summaries.

### Pitfall 5: Phase 03 accidentally implements Phase 05 audit UX

Capture the evidence fields required for guarded work now; leave full audit inspection/correlation UX, budgets, and rollback to Phase 05.

## Open Questions

1. **Exact final-review enforcement surface**
   - Preferred: Claude Code lifecycle hook integration.
   - Fallback: explicit local finalize command if hook semantics are not sufficient in this environment.

2. **Exact freshness binding strategy**
   - Minimum likely sufficient: correlation key + timestamp + changed files/evidence refs.
   - If that proves too weak during implementation, planner may need deterministic fingerprints.

3. **Recommendation identifiers**
   - If advisor verdict contract lacks stable IDs, implementation may derive them deterministically from index/order and preserve them through executor disposition.

## Validation Architecture

### Test Framework

| Property               | Value                                              |
| ---------------------- | -------------------------------------------------- |
| **Framework**          | Node built-in test runner (`node:test`)            |
| **Config file**        | `.claude/package.json`                             |
| **Quick run command**  | `node --test .claude/advisor-mode/tests/*.test.js` |
| **Full suite command** | `node --test .claude/advisor-mode/tests/*.test.js` |
| **Estimated runtime**  | ~10 seconds                                        |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                            | Test Type        | Automated Command                                                      | File Exists? |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- | ------------ |
| GATE-03 | Completion gate refuses non-trivial completion when no fresh advisor final review exists for current evidence       | unit/integration | `node --test .claude/advisor-mode/tests/final-review-gate.test.js`     | No — Wave 0  |
| VERD-01 | Advisor verdict validates required risk/confidence/findings/actions/checklist fields and rejects malformed verdicts | unit/schema      | `node --test .claude/advisor-mode/tests/verdict-handoff.test.js`       | No — Wave 0  |
| VERD-02 | Executor records accept/reject/defer disposition and rationale for each advisor recommendation                      | unit/schema      | `node --test .claude/advisor-mode/tests/disposition.test.js`           | No — Wave 0  |
| AUDT-02 | Evidence record captures commands, exit statuses, concise summaries, changed files, and residual risks              | unit/schema      | `node --test .claude/advisor-mode/tests/verification-evidence.test.js` | No — Wave 0  |
| SAFE-02 | Context packet includes only whitelisted minimized fields and excludes full transcript/raw logs by default          | unit/schema      | `node --test .claude/advisor-mode/tests/context-packet.test.js`        | No — Wave 0  |

### Wave 0 Gaps

- `.claude/advisor-mode/tests/final-review-gate.test.js`
- `.claude/advisor-mode/tests/verdict-handoff.test.js`
- `.claude/advisor-mode/tests/disposition.test.js`
- `.claude/advisor-mode/tests/verification-evidence.test.js`
- `.claude/advisor-mode/tests/context-packet.test.js`
- hook semantics spike or finalize-command fallback proof

## Security Domain

### Applicable ASVS Categories

| ASVS Category       | Applies | Standard Control                                                                                          |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| V4 Access Control   | yes     | Preserve advisor read-only tools and executor-only mutation boundary.                                     |
| V5 Input Validation | yes     | Validate advisor verdicts, context packets, dispositions, and evidence records against versioned schemas. |
| V8 Data Protection  | yes     | Minimize context packets and avoid full transcripts/secrets by default.                                   |
| V14 Configuration   | yes     | Append hook/settings changes idempotently and preserve existing project hooks.                            |

### Known Threat Patterns

| Pattern                                       | Mitigation                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Advisor context leaks secrets/full transcript | Whitelist packet fields, summarize logs, exclude env/secrets and full transcript by default. |
| Malformed advisor verdict treated as valid    | Validate against versioned schema and block/flag completion on invalid shape.                |
| Executor hides rejected recommendations       | Require per-recommendation disposition with rationale and evidence references.               |
| Stale verdict reused after changes            | Bind final review to correlation key, changed files/evidence refs, and timestamp.            |
| Advisor directly runs verification            | Keep advisor tools read-only; executor records verification command evidence.                |

## Sources

### Primary

- `.planning/phases/03-verdict-handoff-and-verification-evidence/03-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/phases/02-enforced-trigger-gates/02-CONTEXT.md`
- `.planning/phases/02-enforced-trigger-gates/02-RESEARCH.md`
- `.planning/phases/02-enforced-trigger-gates/02-PATTERNS.md`
- `.claude/settings.json`
- `.claude/hooks/advisor-gate.js`
- `.claude/hooks/advisor-failure-tracker.js`
- `.claude/advisor-mode/verdict.schema.json`
- `.claude/agents/advisor-reviewer.md`
- `.claude/advisor-mode/README.md`
- `.claude/package.json`

### Secondary

- Claude Code hooks docs
- Claude Code subagents docs
- JSON Schema Draft 2020-12

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH
- Architecture: MEDIUM-HIGH
- Pitfalls: MEDIUM-HIGH

**Research date:** 2026-05-27
**Valid until:** 2026-06-03 for Claude Code hook semantics; 2026-06-26 for local schema/runtime-file architecture.
