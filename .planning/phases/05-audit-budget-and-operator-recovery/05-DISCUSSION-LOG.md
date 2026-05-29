# Phase 5: Audit, Budget, and Operator Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 5-Audit, Budget, and Operator Recovery
**Areas discussed:** Audit trail shape, Budget limits, Operator recovery, Doctor validation, Over-limit behavior, Degraded-mode retained gates

---

## Audit trail shape

| Option             | Description                                                                          | Selected |
| ------------------ | ------------------------------------------------------------------------------------ | -------- |
| Event stream first | Append-only raw event log is the main truth, with correlated views secondary.        |          |
| Session first      | Main operator entrypoint is grouped by session, with tasks secondary.                |          |
| Dual views         | Raw append-only event stream and correlated task/session views are both first-class. | ✓        |

**User's choice:** Dual views
**Notes:** The user later clarified that correlation should also be dual-keyed rather than privileging one axis.

---

## Budget limits

| Option         | Description                                                    | Selected |
| -------------- | -------------------------------------------------------------- | -------- |
| Triple cap     | Enforce hard limits for advisor calls, tokens, and latency.    | ✓        |
| Calls + tokens | Enforce calls and tokens; latency is observational only.       |          |
| Calls only     | Enforce only call count; tokens and latency are observational. |          |

**User's choice:** Triple cap
**Notes:** The user wants Phase 5 to bound both cost and slow-call behavior, not just raw call volume.

---

## Operator recovery

| Option             | Description                                                   | Selected |
| ------------------ | ------------------------------------------------------------- | -------- |
| Global only        | One global mode switch for enforce / warning-only / disabled. |          |
| Layered control    | Global mode plus independently controlled capability classes. | ✓        |
| Finest granularity | Layered control plus per-hook/per-route/per-policy toggles.   |          |

**User's choice:** Layered control
**Notes:** The user prefers practical operational control without exploding runtime complexity.

---

## Doctor validation

| Option             | Description                                                | Selected |
| ------------------ | ---------------------------------------------------------- | -------- |
| Install only       | Check only presence of files/assets.                       |          |
| Operational health | Check install + wiring + permission/route health.          |          |
| Deep doctor        | Operational health plus active smoke-style runtime checks. | ✓        |

**User's choice:** Deep doctor
**Notes:** The user wants active validation, not only static checks.

---

## Audit correlation key

| Option        | Description                                             | Selected |
| ------------- | ------------------------------------------------------- | -------- |
| Session first | Session is the main audit correlation axis.             |          |
| Task first    | Task is the main audit correlation axis.                |          |
| Dual IDs      | Task and session are both first-class correlation keys. | ✓        |

**User's choice:** Dual IDs
**Notes:** This reinforces the dual-view audit model.

---

## Over-limit behavior

| Option           | Description                                                       | Selected |
| ---------------- | ----------------------------------------------------------------- | -------- |
| Hard stop        | Any cap breach blocks all new advisor calls immediately.          |          |
| Graceful degrade | Enter degraded mode; keep only the most critical gates mandatory. | ✓        |
| Dimension based  | Different caps trigger different downgrade rules.                 |          |

**User's choice:** Graceful degrade
**Notes:** The user prefers continuity plus auditability over total shutdown.

---

## Degraded-mode retained gates

| Option                                 | Description                                                                                    | Selected |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Final review only                      | Keep only completion-time final review mandatory.                                              |          |
| Final review + critical human approval | Keep final review and destructive/credential/production-impact human approval gates mandatory. | ✓        |
| Most gates remain                      | Preserve most enforcement and only drop the most expensive advisor paths.                      |          |

**User's choice:** Final review + critical human approval
**Notes:** This is the minimum safety floor the user wants preserved while over budget.

---

## Claude's Discretion

- Exact schema shapes, command names, and internal state layout remain open for planning.

## Deferred Ideas

None.
