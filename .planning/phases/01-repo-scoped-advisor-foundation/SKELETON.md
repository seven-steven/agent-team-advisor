# Walking Skeleton — Advisor Mode

**Phase:** 1
**Generated:** 2026-05-19

## Capability Proven End-to-End

A maintainer can run one repo-local Node command that installs Advisor Mode foundation assets, wires Claude Code hooks, and creates local runtime audit/state placeholders.

## Architectural Decisions

| Decision          | Choice                                                                                      | Rationale                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework         | Claude Code project assets                                                                  | Advisor Mode must run inside Claude Code / Claude Code Teams semantics without a custom server-side advisor tool.          |
| Data layer        | Local filesystem JSON/JSONL baseline                                                        | Phase 1 only needs inspectable local policy examples and runtime audit placeholders; richer audit querying is later scope. |
| Auth              | None in Phase 1                                                                             | This phase has no user authentication flow; safety boundary is advisor tool allowlisting.                                  |
| Deployment target | Local repository scaffold                                                                   | Locked decisions require repo-scoped, local-first assets under `.claude/`, not a hosted bootstrap service.                 |
| Directory layout  | Versioned `.claude/agents/`, `.claude/hooks/`, `.claude/advisor-mode/`; runtime `.advisor/` | Keeps committed behavior separate from generated local audit/state artifacts.                                              |

## Stack Touched in Phase 1

- [ ] Project scaffold (Claude Code assets, hook scripts, Node built-in tests)
- [ ] Routing — Claude Code hook entries in `.claude/settings.json`
- [ ] Database — local filesystem runtime placeholders for audit/state; no database server
- [ ] UI — command-line setup flow documented in `.claude/advisor-mode/README.md`
- [ ] Deployment — documented local full-stack run command: `node .claude/advisor-mode/init.js`

## Out of Scope (Deferred to Later Slices)

- High-risk trigger gate enforcement
- Repeated-failure escalation
- Final advisor review enforcement
- Anthropic-compatible provider routing and conformance
- Budget controls, latency caps, doctor command, and rollback controls
- Hosted control plane or server-side advisor dependency

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Enforced Trigger Gates
- Phase 3: Verdict Handoff and Verification Evidence
- Phase 4: Provider Routing and Conformance
- Phase 5: Audit, Budget, and Operator Recovery
