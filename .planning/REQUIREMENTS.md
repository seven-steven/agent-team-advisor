# Requirements: Advisor Mode

**Defined:** 2026-05-19
**Core Value:** 在不依赖 server_tool_use 的前提下，让 executor 能自主、可靠、可审计地自动触发 advisor，并据此提升复杂工程任务的质量。

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Agent Roles

- [ ] **AGNT-01**: Project maintainer can define an advisor agent that uses a stronger model alias and only read-only review tools
- [ ] **AGNT-02**: User can run an executor-led workflow where only the executor is allowed to mutate the workspace and run implementation tools
- [ ] **AGNT-03**: Project maintainer can version advisor-mode behavior as project-scoped Claude Code assets inside the repository

### Gates & Triggers

- [ ] **GATE-01**: User can require advisor consultation before configured high-risk Bash, Edit, Write, or MultiEdit actions execute
- [ ] **GATE-02**: User can require advisor consultation after the same failure pattern repeats beyond a configurable threshold
- [x] **GATE-03**: User can require a fresh advisor final review before a non-trivial task is marked complete
- [ ] **GATE-04**: User can require explicit human approval for configured critical action classes such as destructive commands, force-pushes, credential changes, and production-affecting operations
- [ ] **GATE-05**: User can allow low-risk read-only actions to proceed without advisor escalation
- [ ] **GATE-06**: Project maintainer can configure risk-scored advisor trigger rules using tool class, file/path class, failure count, and task-completion state

### Advisor Verdicts

- [x] **VERD-01**: User can receive a structured advisor verdict containing risk level, confidence, blocking findings, recommended next actions, and a validation checklist
- [x] **VERD-02**: User can see whether the executor accepted, rejected, or deferred each advisor recommendation, with a recorded rationale

### Routing & Models

- [ ] **ROUT-01**: Project maintainer can map Claude semantic aliases such as sonnet, opus, and haiku to third-party models through Anthropic-compatible provider settings
- [ ] **ROUT-02**: User can inspect which concrete provider and model served each executor or advisor call
- [ ] **ROUT-03**: Project maintainer can run a conformance check that validates the selected gateway/provider against required Anthropic-compatible message, tool, streaming, and usage behaviors before enabling advisor-critical flows
- [ ] **ROUT-04**: Project maintainer can configure the reference route of GLM as executor and GPT-5.5 as advisor without changing workflow logic

### Audit & Verification

- [ ] **AUDT-01**: User can inspect an append-only local audit trail for advisor triggers, hook decisions, provider routes, advisor verdicts, and executor follow-up decisions
- [x] **AUDT-02**: User can capture verification evidence for guarded work, including commands run, exit status, concise result summaries, changed files, and residual risks
- [ ] **AUDT-03**: User can correlate advisor-mode audit events with task or session identifiers

### Safety & Operations

- [ ] **SAFE-01**: User can set hard limits for advisor calls, advisor tokens, or advisor latency per task or session
- [ ] **SAFE-02**: User can send advisors a minimized context packet based on relevant diffs, errors, files, and explicit questions instead of the full transcript by default
- [ ] **SAFE-03**: Project maintainer can disable advisor enforcement or switch to warning-only mode through a documented kill switch or rollback path
- [ ] **SAFE-04**: User can protect changes to advisor policy, hook scripts, provider routes, and Claude Code configuration behind advisor review or human approval

### Setup & Operator UX

- [ ] **SETP-01**: Project maintainer can scaffold advisor-mode agent definitions, hooks, settings, policy examples, and audit directories from a documented setup flow
- [ ] **SETP-02**: User can run a doctor or validation command that verifies required hooks, routes, advisor permissions, and project assets are installed correctly

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Policy Tuning

- **POLY-01**: Project maintainer can lint advisor policy files and run them in dry-run mode against recorded sessions
- **POLY-02**: User can view explainable trigger reports that show why advisor escalation happened or was skipped
- **POLY-03**: Project maintainer can maintain model capability profiles that tune routing and trigger thresholds per provider/model pair

### Replay & Evaluation

- **REPL-01**: Project maintainer can replay a recorded advisor trigger packet against another advisor model or revised policy without re-running executor actions
- **REPL-02**: Project maintainer can run shadow or A/B advisor evaluations to compare route quality before rollout

### Advanced Coordination

- **COOR-01**: User can require multi-advisor quorum for selected critical review classes
- **COOR-02**: User can use a local dashboard or run viewer to inspect sessions, triggers, costs, diffs, and verdict history
- **COOR-03**: Project maintainer can use a learning loop that suggests policy adjustments from accepted or rejected advisor findings

## Out of Scope

| Feature                                                                     | Reason                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Native Anthropic `advisor_20260301` or other server-side advisor dependency | Project goal is a pure client-side implementation                   |
| Advisor directly editing code or executing commands                         | Violates the intended read-only advisor boundary and increases risk |
| Always consulting the advisor on every step                                 | Destroys the cost/latency advantage and creates alert fatigue       |
| Silent provider fallback for advisor-critical gates                         | Hides quality degradation and breaks auditability                   |
| Mandatory hosted control plane for orchestration                            | Conflicts with the local-first, repo-scoped project goal            |
| Automatic approval of destructive or production-impacting actions           | Critical authority must remain with a human                         |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| AGNT-01     | Phase 1 | Pending  |
| AGNT-02     | Phase 1 | Pending  |
| AGNT-03     | Phase 1 | Pending  |
| GATE-01     | Phase 2 | Pending  |
| GATE-02     | Phase 2 | Pending  |
| GATE-03     | Phase 3 | Complete |
| GATE-04     | Phase 2 | Pending  |
| GATE-05     | Phase 2 | Pending  |
| GATE-06     | Phase 2 | Pending  |
| VERD-01     | Phase 3 | Complete |
| VERD-02     | Phase 3 | Complete |
| ROUT-01     | Phase 4 | Pending  |
| ROUT-02     | Phase 4 | Pending  |
| ROUT-03     | Phase 4 | Pending  |
| ROUT-04     | Phase 4 | Pending  |
| AUDT-01     | Phase 5 | Pending  |
| AUDT-02     | Phase 3 | Complete |
| AUDT-03     | Phase 5 | Pending  |
| SAFE-01     | Phase 5 | Pending  |
| SAFE-02     | Phase 3 | Complete |
| SAFE-03     | Phase 5 | Pending  |
| SAFE-04     | Phase 2 | Pending  |
| SETP-01     | Phase 1 | Pending  |
| SETP-02     | Phase 5 | Pending  |

**Coverage:**

- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---

_Requirements defined: 2026-05-19_
_Last updated: 2026-05-27 after Phase 03 completion_
