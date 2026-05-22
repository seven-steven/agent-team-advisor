# Phase 2: Enforced Trigger Gates - Research

**Researched:** 2026-05-21
**Replanned:** 2026-05-21
**Domain:** Claude Code hooks, repo-scoped policy gates, advisor consultation producer chain, human approval disposition gates
**Confidence:** MEDIUM-HIGH
**Runtime Semantics Status:** FORMALLY RESOLVED BY PLAN 01 PREREQUISITE

<user_constraints>

## User Constraints (from CONTEXT.md)

Locked decisions D-01 through D-17 remain binding:

- D-01/D-02: high-risk trigger rules are combined policy rules in repo-scoped advisor-mode policy files; hooks evaluate policy and are not the canonical rule source.
- D-03/D-04: host-agent tool permissions remain outside Advisor Mode; Phase 2 emits advisor consultation workflow gates and human decision gates only.
- D-05/D-06/D-07/D-08: repeated failures are grouped by normalized signature, trigger at threshold 2, emit structural advisor-consultation state, and do not directly block host tool execution.
- D-09/D-10/D-11/D-12/D-13: human approval is a workflow decision gate for irreversible, security-boundary, shared/production-impacting, and governance-configuration decisions; it requires explicit disposition plus explicit retry after a valid artifact exists; packets include trigger reason, decision summary, risk level, options, advisor recommendation, expected consequences, and suggested verification points; outcomes are approve, reject, revise, defer.
- D-14/D-15/D-16/D-17: protected surfaces include policy/schema files, hooks/settings wiring, agent/command assets, provider-route and credential-control surfaces; detection is path-class-first; protected changes trigger advisor review by default and human approval for critical decision classes; protected-surface events carry their own audit label.

</user_constraints>

## Phase Requirements

| ID      | Phase 2 planning disposition                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GATE-01 | Plan 02 implements high-risk advisor consultation as request artifact plus explicit recommendation producer handoff plus validated recommendation re-entry. |
| GATE-02 | Plan 03 implements repeated-failure threshold 2 with normalized signatures and required later advisor disposition state.                                    |
| GATE-04 | Plan 03 implements human approval packet, persisted approve/reject/revise/defer dispositions, and re-entry validation.                                      |
| GATE-05 | Plan 02 keeps low-risk read-only actions outside the advisor gate matcher and policy escalation.                                                            |
| GATE-06 | Plans 02-04 implement configurable policy dimensions: tool class, path class, action class, failure count, and task state.                                  |
| SAFE-04 | Plan 04 implements path-class-first protected surfaces connected to advisor review and human approval/disposition chains.                                   |

## Architecture Responsibility Map

| Capability                           | Primary Tier                                 | Secondary Tier                                   | Planning Contract                                                                                                       |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Runtime hook blocking/wait semantics | Plan 01 runtime probe                        | Claude Code hook runtime                         | Must be empirically verified before downstream gate plans run.                                                          |
| High-risk classification             | Repo Policy Config                           | Local Hook Runtime                               | Policy owns rules; hook evaluates combined dimensions.                                                                  |
| Advisor consultation request         | Local Hook Runtime                           | Runtime `.advisor/consultations`                 | Hook writes request artifact with correlation key.                                                                      |
| Advisor recommendation producer      | Executor-triggered read-only advisor surface | `advisor-reviewer` agent / project-local handoff | Executor invokes read-only advisor with request artifact and persists recommendation artifact; advisor does not mutate. |
| Recommendation validation/re-entry   | Local Hook Runtime                           | Runtime recommendation artifact                  | Re-entry allowed only after matching valid recommendation artifact exists.                                              |
| Repeated-failure escalation          | Runtime State                                | PostToolUse hook                                 | Normalized signature counter triggers advisor consultation at count 2.                                                  |
| Human approval decision gate         | Workflow Gate                                | Runtime disposition artifact                     | Missing disposition remains blocked; approve/reject/revise/defer are persisted and validated.                           |
| Protected surfaces                   | Repo Policy Config                           | Gate evaluator                                   | Path-class-first policy classes trigger advisor review or critical human approval chain.                                |

## Runtime Semantics Resolution

The previous unresolved research item “exact hook blocking JSON vs exit-code behavior” is resolved by Plan 01 evidence, not left to ad hoc implementation.

Observed Claude Code 2.1.146 host contract from the disposable PreToolUse smoke:

1. `hookSpecificOutput.hookEventName: "PreToolUse"` plus `permissionDecision: "deny"` blocks the Bash tool call and surfaces `permissionDecisionReason` as the denial message.
2. `permissionDecision: "allow"` permits the same Bash fixture to execute on explicit retry after a valid matching disposition artifact exists.
3. Hooks exiting 0 with only `additionalContext` are accepted as contextual output and do not host-enforce local workflow state.
4. Malformed stdin and missing tool-name probe inputs exit 0 without host-blocking, preserving the disposable probe's fail-open contract for non-meaningful events.
5. Custom workflow metadata is recorded only inside local Advisor Mode state (`additionalContext` and `.advisor/decisions/dispositions/{correlationKey}.json`), not as host-enforced hook fields.
6. Missing dispositions keep local state `blocked-pending-human`; valid matching `approve|reject|revise|defer` artifacts make the local state `satisfied` only for explicit retry.

This converts runtime semantics from an unresolved implementation-time assumption into a front-loaded phase gate.

## Standard Stack

No external packages are required for Phase 2. Use:

- Node.js built-ins and CommonJS hook modules.
- Node built-in `node:test`.
- Project-local `.claude/settings.json` as the only hook wiring seam.
- Existing read-only `.claude/agents/advisor-reviewer.md` as the advisor producer target.
- Runtime files under ignored `.advisor/` paths, not `.planning/`.

## Package Legitimacy Audit

No package-manager install tasks are planned.

| Package | Registry | slopcheck | Disposition         |
| ------- | -------- | --------- | ------------------- |
| none    | —        | —         | No install required |

## Planned Runtime Artifacts

| Artifact                                                       | Writer                                          | Reader                       | Purpose                                                                          | Git status |
| -------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- | ---------- |
| `.advisor/consultations/requests/{correlationKey}.json`        | `advisor-gate.js`                               | executor/advisor producer    | Input packet for read-only advisor recommendation                                | ignored    |
| `.advisor/consultations/recommendations/{correlationKey}.json` | executor persists read-only advisor output      | `advisor-gate.js`            | Validated recommendation allowing advisor gate re-entry or human packet creation | ignored    |
| `.advisor/state/failure-signatures.json`                       | `advisor-failure-tracker.js`                    | `advisor-failure-tracker.js` | Normalized repeated-failure counters                                             | ignored    |
| `.advisor/audit/events.jsonl`                                  | hooks                                           | later audit phase            | Concise gate/failure/protected-surface event records                             | ignored    |
| `.advisor/decisions/dispositions/{correlationKey}.json`        | human/executor after explicit approval decision | `advisor-gate.js`            | approve/reject/revise/defer disposition for human gate re-entry                  | ignored    |

## Fail-Open / Hard-Stop Contract

| Condition                                                                  | Disposition                        | Required Plan Coverage |
| -------------------------------------------------------------------------- | ---------------------------------- | ---------------------- |
| Malformed host payload that cannot be parsed as a meaningful hook event    | Fail open                          | Plan 02 tests          |
| Missing tool name in host input                                            | Fail open                          | Plan 02 tests          |
| Missing or unreadable repo-scoped gate policy for configured matcher event | Blocking hard-stop workflow state  | Plan 02 tests          |
| Classification failure for configured matcher event                        | Blocking hard-stop workflow state  | Plan 02 tests          |
| Required request artifact write failure for high-risk gated event          | Blocking hard-stop workflow state  | Plan 02 tests          |
| Missing/malformed/mismatched recommendation after a request exists         | `blocked-pending-advisor` re-entry | Plan 02 tests          |
| Missing/malformed/mismatched human disposition                             | `blocked-pending-human` re-entry   | Plan 01/03 tests       |

The hard-stop contract is part of the runtime safety model: configured risky events must not proceed ungated when the gate cannot load policy, classify the event, or persist the required advisor request artifact.

## Anti-Patterns to Avoid

- Request/recommendation filenames without a recommendation producer chain.
- Human approval packets without persisted disposition state and re-entry validation.
- Leaving Claude Code blocking/wait semantics as an implementation-time unknown.
- Treating Advisor Mode as a host permission system.
- Giving advisor mutating tools.
- Hard-coding protected surfaces only inside hook scripts.
- Committing runtime `.advisor/*.json` or `.advisor/*.jsonl` files.
- Failing open on policy-load, classification, or required artifact write failures for configured/gated events.

## Validation Architecture

| Plan  | Primary automated test                                                                              |
| ----- | --------------------------------------------------------------------------------------------------- |
| 02-01 | `node --test .claude/advisor-mode/tests/runtime-semantics.test.js` plus real Claude Code hook smoke |
| 02-02 | `node --test .claude/advisor-mode/tests/advisor-consultation.test.js`                               |
| 02-03 | `node --test .claude/advisor-mode/tests/failure-and-human-gates.test.js`                            |
| 02-04 | `node --test .claude/advisor-mode/tests/protected-surface.test.js`                                  |
| Phase | `node --test .claude/advisor-mode/tests/*.test.js`                                                  |

## Open Questions (RESOLVED)

All Phase 2 feasibility questions are formally resolved for planning:

| Former question                                      | Resolution status | Final runtime contract                                                                                                                                   |
| ---------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact hook blocking JSON vs exit-code behavior       | RESOLVED          | Plan 01 is the Wave 1 prerequisite; it records the observed Claude Code `permissionDecision`/exit-code behavior before Plans 02-04 execute.              |
| Whether D-11 wait-for-disposition semantics are safe | RESOLVED          | Human approval remains workflow state, not host wait-state; missing disposition remains blocked locally until explicit retry after a valid artifact.     |
| Whether high-risk gate infrastructure may fail open  | RESOLVED          | Only malformed host payload or missing tool name fail open; policy-load, classification, and request-write failure on configured/gated events hard-stop. |
| Who produces advisor recommendation artifacts        | RESOLVED          | Executor triggers read-only `advisor-reviewer` with request artifact input and persists matching recommendation artifact for explicit retry re-entry.    |
| Whether protected surfaces use a separate gate model | RESOLVED          | Protected surfaces reuse the Plan 02 advisor producer chain and Plan 03 human disposition chain, with path-class-first policy data.                      |

No unresolved Open Questions remain. If the empirical runtime probe contradicts the planned contract, Phase 2 execution stops for plan revision rather than continuing on an assumption.

## Sources

- `/home/seven/data/coding/projects/seven/agent-team-advisor/CLAUDE.md`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/REQUIREMENTS.md`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/ROADMAP.md`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/phases/02-enforced-trigger-gates/02-CONTEXT.md`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/phases/02-enforced-trigger-gates/02-PATTERNS.md`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/settings.json`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/agents/advisor-reviewer.md`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/advisor-boundary-check.js`
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/policy.example.json`
