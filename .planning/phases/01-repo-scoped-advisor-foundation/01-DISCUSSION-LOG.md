# Phase 1: Repo-Scoped Advisor Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1-Repo-Scoped Advisor Foundation
**Areas discussed:** Asset Layout, Advisor Boundary, Scaffold Experience, Runtime State & Audit Baseline

---

## Asset Layout

| Option                                                   | Description                                                                                          | Selected |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| Project-local `.claude` assets + `.claude/advisor-mode/` | Keep scaffold assets repo-scoped, versioned, and aligned with existing Claude Code project structure | ✓        |
| Mixed root-level files plus user-global config           | Split behavior between repo and developer machine state                                              |          |
| Separate external control-plane repo                     | Move scaffold logic outside the project repository                                                   |          |

**User's choice:** [auto] Selected project-local `.claude` assets + `.claude/advisor-mode/`.
**Notes:** Recommended because the repo already centralizes Claude automation under `.claude/`, and Phase 1 is specifically about repo-scoped foundation assets.

---

## Advisor Boundary

| Option                                          | Description                                                           | Selected |
| ----------------------------------------------- | --------------------------------------------------------------------- | -------- |
| Read-only advisor with structured verdicts      | Advisor keeps review-only tools and returns risk/verdict-first output | ✓        |
| Advisor may edit files but not run Bash         | Allows partial mutation from the advisor role                         |          |
| Advisor and executor share the same tool access | Removes the hard boundary between roles                               |          |

**User's choice:** [auto] Selected read-only advisor with structured verdicts.
**Notes:** Recommended because project constraints already lock advisor as read-only and Phase 1 exists to make that boundary structural, not prompt-only.

---

## Scaffold Experience

| Option                                        | Description                                                       | Selected |
| --------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Single scaffold flow with versioned templates | One repo-local setup path writes the baseline assets and examples | ✓        |
| Manual file-by-file setup                     | Maintainer assembles each hook, agent, and config file by hand    |          |
| Hosted wizard or remote bootstrap             | Setup depends on a remote control plane or external service       |          |

**User's choice:** [auto] Selected single scaffold flow with versioned templates.
**Notes:** Recommended because the phase goal includes installable repo-scoped assets, and a single setup flow is the clearest way to make them reproducible.

---

## Runtime State & Audit Baseline

| Option                                                  | Description                                                                                | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Versioned policy + local runtime state/JSONL audit dirs | Keep committed policy separate from local runtime artifacts and use append-only audit logs | ✓        |
| Versioned markdown only                                 | Store state and audit information only in committed docs                                   |          |
| Remote telemetry first                                  | Make runtime audit depend on a remote sink from the start                                  |          |

**User's choice:** [auto] Selected versioned policy + local runtime state/JSONL audit dirs.
**Notes:** Recommended because later phases need runtime evidence, but this project is explicitly local-first and Phase 1 should avoid committing volatile runtime state into planning docs.

---

## Claude's Discretion

- Exact scaffold command name
- Exact file names under `.claude/advisor-mode/`
- Exact hidden runtime directory name, as long as it stays project-local and separate from versioned policy

## Deferred Ideas

None
