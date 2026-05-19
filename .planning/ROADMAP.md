# Roadmap: Advisor Mode

## Overview

Advisor Mode v1 builds a pure client-side Claude Code Teams workflow in dependency order: first establish repo-scoped advisor/executor assets and read-only boundaries, then enforce automatic gate triggers, then standardize advisor verdict handoffs and verification evidence, then connect Anthropic-compatible provider routing, and finally harden the system with audit, budget, validation, and rollback controls.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Repo-Scoped Advisor Foundation** - Maintainers can install project-local advisor assets with enforced executor/advisor role boundaries. (completed 2026-05-19)
- [ ] **Phase 2: Enforced Trigger Gates** - Users can rely on policy-driven advisor and human approval gates before risky or repeated-failure actions proceed.
- [ ] **Phase 3: Verdict Handoff and Verification Evidence** - Users receive structured advisor guidance, executor rationale, minimized context handoffs, and verification evidence.
- [ ] **Phase 4: Provider Routing and Conformance** - Maintainers can route Claude semantic aliases to third-party models and validate provider compatibility before critical flows.
- [ ] **Phase 5: Audit, Budget, and Operator Recovery** - Users can inspect correlated audit history, cap advisor cost/latency, validate installation, and disable enforcement safely.

## Phase Details

### Phase 1: Repo-Scoped Advisor Foundation

**Goal**: As a maintainer, I want to scaffold repo-scoped Advisor Mode assets, so that I can safely evolve the workflow.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AGNT-01, AGNT-02, AGNT-03, SETP-01
**Success Criteria** (what must be TRUE):

1. Project maintainer can scaffold advisor agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow.
2. Project maintainer can define an advisor agent that uses a stronger model alias and exposes only read-only review tools.
3. User can run an executor-led workflow where workspace mutation and implementation tools remain available only to the executor.
4. Project maintainer can commit and version advisor-mode behavior as project-scoped Claude Code assets inside the repository.

**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 01-01-PLAN.md — Create the repo-local scaffold command and Walking Skeleton assets.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Validate and harden advisor/executor role boundaries.
- [x] 01-03-PLAN.md — Document and test the versioned scaffold layout.

### Phase 2: Enforced Trigger Gates

**Goal**: Users can depend on configurable gates that automatically require advisor consultation or human approval at high-risk decision points.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: GATE-01, GATE-02, GATE-04, GATE-05, GATE-06, SAFE-04
**Success Criteria** (what must be TRUE):

1. User can require advisor consultation before configured high-risk Bash, Edit, Write, or MultiEdit actions execute.
2. User can require advisor consultation when the same failure pattern repeats beyond a configurable threshold.
3. User can allow low-risk read-only actions to proceed without advisor escalation.
4. User can require explicit human approval for configured critical action classes, including destructive commands, force-pushes, credential changes, and production-affecting operations.
5. User can protect advisor policy, hook scripts, provider routes, and Claude Code configuration changes behind advisor review or human approval.
   **Plans**: TBD

### Phase 3: Verdict Handoff and Verification Evidence

**Goal**: Users can make completion decisions from structured advisor verdicts, concise context packets, executor rationale, and verification evidence.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: GATE-03, VERD-01, VERD-02, AUDT-02, SAFE-02
**Success Criteria** (what must be TRUE):

1. User can require a fresh advisor final review before a non-trivial task is marked complete.
2. User can receive a structured advisor verdict containing risk level, confidence, blocking findings, recommended next actions, and a validation checklist.
3. User can see whether the executor accepted, rejected, or deferred each advisor recommendation, with a recorded rationale.
4. User can send advisors a minimized context packet based on relevant diffs, errors, files, and explicit questions instead of the full transcript by default.
5. User can capture verification evidence for guarded work, including commands run, exit status, concise result summaries, changed files, and residual risks.
   **Plans**: TBD

### Phase 4: Provider Routing and Conformance

**Goal**: Project maintainers can map Claude semantic aliases to concrete third-party models and prove the selected gateway is safe for advisor-critical flows.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ROUT-01, ROUT-02, ROUT-03, ROUT-04
**Success Criteria** (what must be TRUE):

1. Project maintainer can map Claude semantic aliases such as sonnet, opus, and haiku to third-party models through Anthropic-compatible provider settings.
2. Project maintainer can configure the reference route of GLM as executor and GPT-5.5 as advisor without changing workflow logic.
3. Project maintainer can run a conformance check that validates required Anthropic-compatible message, tool, streaming, and usage behaviors before enabling advisor-critical flows.
4. User can inspect which concrete provider and model served each executor or advisor call.
   **Plans**: TBD

### Phase 5: Audit, Budget, and Operator Recovery

**Goal**: Users can operate Advisor Mode with correlated audit history, bounded advisor usage, install validation, and safe rollback controls.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: AUDT-01, AUDT-03, SAFE-01, SAFE-03, SETP-02
**Success Criteria** (what must be TRUE):

1. User can inspect an append-only local audit trail for advisor triggers, hook decisions, provider routes, advisor verdicts, and executor follow-up decisions.
2. User can correlate advisor-mode audit events with task or session identifiers.
3. User can set hard limits for advisor calls, advisor tokens, or advisor latency per task or session.
4. Project maintainer can disable advisor enforcement or switch to warning-only mode through a documented kill switch or rollback path.
5. User can run a doctor or validation command that verifies required hooks, routes, advisor permissions, and project assets are installed correctly.
   **Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase                                        | Plans Complete | Status      | Completed |
| -------------------------------------------- | -------------- | ----------- | --------- |
| 1. Repo-Scoped Advisor Foundation            | 3/3 | Complete   | 2026-05-19 |
| 2. Enforced Trigger Gates                    | 0/TBD          | Not started | -         |
| 3. Verdict Handoff and Verification Evidence | 0/TBD          | Not started | -         |
| 4. Provider Routing and Conformance          | 0/TBD          | Not started | -         |
| 5. Audit, Budget, and Operator Recovery      | 0/TBD          | Not started | -         |
