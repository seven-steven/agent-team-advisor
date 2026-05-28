# Phase 04: Provider Routing and Conformance - Research

**Researched:** 2026-05-27  
**Revised:** 2026-05-28  
**Domain:** Claude Code provider routing, Anthropic-compatible conformance, local audit artifacts  
**Confidence:** MEDIUM

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 4 provider routing is a thin mapping layer from Claude semantic aliases to concrete `provider + model` targets plus minimal route metadata needed for conformance and audit.
- **D-02:** Provider routing must **not** absorb advisor gates, verdict handling, or broader workflow control logic; those stay in the existing Advisor Mode runtime chain.
- **D-03:** Prefer plugin/skill-owned hook assets as the primary control surface so the integration feels self-contained and avoids unnecessary pollution of user configuration.
- **D-04:** Repo-local configuration remains an allowed fallback only where project-level override or explicit versioned auditability is needed.
- **D-05:** Phase 4 should support declarative default routes rather than hard-coded fixed routes or example-only placeholders.
- **D-06:** The reference route should ship with a default mapping story such as `sonnet → GLM` and `opus → GPT-5.5`, while preserving workflow independence so maintainers can swap concrete targets without changing executor/advisor logic.
- **D-07:** Conformance should validate critical Anthropic-compatible behaviors needed for advisor-critical flows: base message requests, streaming, tool-use behavior, usage fields, error shape, and other directly depended-on runtime semantics.
- **D-08:** Phase 4 should avoid full exhaustive protocol certification; the target is “safe for advisor-critical flows,” not total protocol completeness.
- **D-09:** The actual resolved provider and model for executor/advisor calls should be recorded in runtime artifacts and audit surfaces by default.
- **D-10:** That visibility should be audit-first and operator-facing, not necessarily pushed into every normal user-facing output by default.

### Deferred Ideas

None.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                            | Research Support                                                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROUT-01 | Project maintainer can map Claude semantic aliases such as sonnet, opus, and haiku to third-party models through Anthropic-compatible provider settings                                                                | Use declarative `provider-routes` schema under `.claude/advisor-mode/`, keep `alias -> provider/model` mapping separate from gates/verdicts, and protect route files through existing protected-surface policy.                                               |
| ROUT-02 | User can inspect which concrete provider and model served each executor or advisor call                                                                                                                                | Wire resolved route metadata into the real advisor consultation runtime/audit chain by enriching `.claude/hooks/advisor-gate.js` request artifacts with sanitized `routeResolution`, and also emit route/conformance state/audit artifacts under `.advisor/`. |
| ROUT-03 | Project maintainer can run a conformance check that validates the selected gateway/provider against required Anthropic-compatible message, tool, streaming, and usage behaviors before enabling advisor-critical flows | Implement targeted conformance command with mocked deterministic tests and a live provider-doc/operator checkpoint for external request shapes and env syntax.                                                                                                |
| ROUT-04 | Project maintainer can configure the reference route of GLM as executor and GPT-5.5 as advisor without changing workflow logic                                                                                         | Ship declarative route examples for semantic aliases (`sonnet`, `opus`, `haiku`) and keep workflow logic consuming aliases only.                                                                                                                              |

</phase_requirements>

## Summary

Phase 4 introduces a narrow provider-routing layer, not a new orchestration layer. The route layer owns declarative alias resolution (`sonnet`, `opus`, `haiku` → concrete provider/model + minimal metadata), conformance evidence, and audit visibility. The existing Advisor Mode gate, verdict, final-review, and human-disposition chain remains the workflow authority.

Checker revision clarified ROUT-02: helper-only route/conformance artifacts are insufficient. The plan now requires `.claude/hooks/advisor-gate.js` to consume the route resolver and include sanitized resolved route metadata on real advisor consultation request artifacts by default. This gives operators an audit-visible path from actual advisor runtime calls to `requestedAlias`, `resolvedProvider`, and `resolvedModel`, while preserving D-01/D-02 because the route layer remains metadata enrichment rather than gate control.

Conformance remains a maintainers' targeted validation command, not full protocol certification. It proves the selected Anthropic-compatible gateway is safe enough for advisor-critical flows by validating base request/response, streaming, tool-use round trip, usage fields, and error shape, then recording resolved provider/model metadata in audit and runtime artifacts.

**Primary recommendation:** Implement `provider-routes` as a schema-validated declarative config plus route resolver, wire sanitized route resolution into `advisor-gate.js` request artifacts, and add a targeted conformance command that emits `.advisor/` state/audit evidence without moving workflow logic out of existing hooks.

## Architectural Responsibility Map

| Capability                      | Primary Tier                                 | Secondary Tier               | Rationale                                                                                                                                               |
| ------------------------------- | -------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic alias route definition | Local config / plugin asset                  | Repo-local override          | Route definitions are Advisor Mode configuration assets; plugin/skill-owned defaults are preferred and repo-local override is allowed for auditability. |
| Route resolution                | Local runtime utility / hook-adjacent script | Gateway/provider             | Advisor Mode resolves semantic aliases before audit/conformance while the gateway executes the actual provider request.                                 |
| Runtime route visibility        | Existing Advisor Mode runtime/audit chain    | Route resolver metadata      | ROUT-02 requires real runtime visibility, so `advisor-gate.js` request artifacts must include sanitized `routeResolution` by default.                   |
| Conformance validation          | Local CLI / doctor command                   | Anthropic-compatible gateway | Maintainer runs local validation against the selected gateway before advisor-critical flows are trusted.                                                |
| Protected route changes         | Existing PreToolUse gate                     | Human/advisor disposition    | Existing policy already treats provider-route files as protected surfaces governed by advisor/human approval gates.                                     |
| Workflow gate decisions         | Existing Advisor Mode hooks                  | Route resolver metadata      | Routing must not absorb gates, verdict handling, or workflow control.                                                                                   |

## Standard Stack

| Surface                                                   | Purpose                                                              | Decision                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Node.js runtime                                           | Route resolver, hook metadata enrichment, conformance command, tests | Use existing CommonJS + native Node APIs; no new package install.                                |
| Native `node:test`                                        | Unit/integration tests                                               | Use existing `node --test .claude/advisor-mode/tests/*.test.js` pattern.                         |
| JSON Schema files under `.claude/advisor-mode/`           | Route and conformance contracts                                      | Keep strict draft 2020-12 schemas with `additionalProperties: false`.                            |
| `.claude/hooks/advisor-gate.js`                           | Real runtime advisor consultation request chain                      | Add metadata-only `buildRuntimeRouteMetadata()` and `routeResolution` request field for ROUT-02. |
| `.advisor/audit/events.jsonl` and `.advisor/state/*.json` | Local runtime evidence                                               | Store sanitized provider/model/conformance state and audit events; no secrets.                   |

## Package Legitimacy Audit

Phase 4 baseline installs no external packages, so the package legitimacy gate is not applicable.

| Package  | Registry | Age | Downloads | Source Repo | slopcheck | Disposition            |
| -------- | -------- | --- | --------- | ----------- | --------- | ---------------------- |
| _(none)_ | —        | —   | —         | —           | —         | No install recommended |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Pattern 1: Thin Route Resolver

A pure CommonJS utility validates route config and resolves a semantic alias to sanitized provider/model metadata. It exports `validateRouteConfig`, `loadRouteConfig`, `resolveRoute`, `buildResolvedRouteAuditEvent`, and `writeResolvedRouteArtifact`.

Use this for any Advisor Mode surface that needs to record or validate which concrete provider/model is behind `sonnet`, `opus`, or `haiku`. The resolver returns explicit failure metadata such as `reasonCode: "missing-route"`; it never silently selects a fallback provider/model.

### Pattern 2: Real Runtime Route Metadata Wiring

`advisor-gate.js` remains the runtime gate authority, but it imports or requires the route resolver to enrich advisor consultation requests with a `routeResolution` object by default. The object records only `requestedAlias`, `resolvedProvider`, `resolvedModel`, `endpointRef`, `routeConfigPath`, and `conformanceStatus` or explicit `ok: false` failure metadata.

This pattern closes ROUT-02 without broadening routing into workflow control: route metadata is observable evidence, not a gate decision, verdict, fallback policy, budget rule, or rollback mechanism.

### Pattern 3: Targeted Conformance as Evidence-Producing Doctor Command

A local command loads route config, resolves selected aliases, performs bounded gateway checks, and writes a conformance artifact plus audit event. Checks are limited to `base-message`, `streaming`, `tool-use`, `usage-fields`, and `error-shape`. Unsupported or malformed provider behavior is a conformance failure, not a warning-only pass.

### Pattern 4: Audit-First Route Visibility

Runtime artifacts record `requestedAlias`, `resolvedProvider`, `resolvedModel`, and conformance status. Normal user-facing output remains concise unless an operator asks for details.

## Anti-Patterns to Avoid

- Routing logic inside advisor prompts.
- Silent provider fallback for advisor-critical gates.
- Treating conformance as comprehensive API certification.
- Writing route changes outside protected-surface governance.
- Logging secrets in route config, request artifacts, conformance artifacts, or audit logs.
- Satisfying ROUT-02 with helper-only artifacts that are disconnected from the real advisor consultation runtime chain.

## Open Questions (RESOLVED)

1. **What exact plugin/skill-owned hook distribution mechanism should Phase 4 target?**
   - Resolution: Phase 4 preserves the plugin/skill-owned preference as the desired distribution interface, but execution is allowed to use repo-local `.claude/advisor-mode/` route assets when no supported plugin/skill mechanism exists in this repo. This is an explicit D-04 fallback, not a deferred blocker.
   - Plan gate: 04-01 Task 1 verifies the distribution choice before route defaults are edited.

2. **Which concrete provider/model identifiers should represent GLM executor and GPT-5.5 advisor?**
   - Resolution: Exact IDs are provider/operator facts, not architecture decisions. The plan now treats them as a blocking human/provider-doc checkpoint before writing route defaults. This makes execution deterministic: either verified IDs are recorded as non-secret route metadata, or execution blocks without shipping guessed IDs.
   - Plan gate: 04-01 Task 1 verifies concrete IDs and permits only provider IDs, model IDs, `endpointRef`, and `credentialEnv` names in repository files.

3. **How should conformance authenticate without leaking secrets?**
   - Resolution: Route config and artifacts store endpoint references and credential env var names only. Secret values stay in operator-owned environment variables and are never committed, logged, or included in audit artifacts.
   - Plan gate: 04-02 Task 1 verifies gateway env syntax from current provider/operator docs; 04-02 Tasks 2-3 test and implement secret redaction/omission.

4. **How are external provider docs handled when planner-session docs are unavailable?**
   - Resolution: External provider docs remain an execution-time blocking pre-flight gate, not an unresolved research blocker. The executable plan has explicit human/provider-doc checkpoints before concrete IDs or live request shapes are implemented. Automated tests use mocked gateway behavior and do not depend on network or credentials.
   - Plan gate: 04-01 Task 1 and 04-02 Task 1 must complete before implementation tasks that lock route defaults or live conformance behavior.

## Environment Availability

| Dependency                       | Required By                                              | Available / Decision                                    | Fallback                                                 |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Node.js                          | Hooks, route resolver, conformance command, tests        | Available in project environment                        | None needed                                              |
| npm command                      | Optional package/version checks                          | Not needed for baseline because no installs are planned | Keep package install count at zero                       |
| Current provider docs            | Provider IDs, gateway env syntax, request/response shape | Execution-time human/provider-doc checkpoint            | Block implementation until operator verifies docs/config |
| Network/live gateway credentials | Live conformance smoke                                   | Operator-owned setup only                               | Mocked automated tests still run deterministically       |

## Validation Architecture

| Req ID  | Behavior                                                                                                                          | Test Type                                    | Automated Command                                                                                                         | Created By         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| ROUT-01 | Maintainer can map semantic aliases to provider/model targets through route config                                                | unit/schema                                  | `node --test .claude/advisor-mode/tests/provider-routing.test.js`                                                         | 04-01-02           |
| ROUT-02 | Runtime/audit artifacts expose resolved concrete provider/model for real advisor consultation requests and conformance artifacts  | unit/integration artifact                    | `node --test .claude/advisor-mode/tests/provider-routing.test.js .claude/advisor-mode/tests/provider-conformance.test.js` | 04-01-02, 04-02-02 |
| ROUT-03 | Conformance command validates base message, streaming, tool-use, usage fields, and error shape before advisor-critical enablement | unit with mocked gateway + manual live smoke | `node --test .claude/advisor-mode/tests/provider-conformance.test.js`                                                     | 04-02-02           |
| ROUT-04 | Reference GLM executor and GPT-5.5 advisor routes can be configured without changing workflow logic                               | unit/config fixture                          | `node --test .claude/advisor-mode/tests/provider-routing.test.js`                                                         | 04-01-02           |

## Security Domain

| Threat Pattern                                        | STRIDE                             | Standard Mitigation                                                                                                             |
| ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Route tampering to downgrade advisor model            | Tampering / Elevation of Privilege | Protect route config files through existing protected-surface advisor/human gates and validate route schema before resolution.  |
| Secret leakage through route config or audit logs     | Information Disclosure             | Store only env var names/endpoint references; redact or omit request headers, bearer tokens, and request bodies from artifacts. |
| Silent provider fallback during critical advisor flow | Repudiation / Tampering            | Return explicit failure metadata; do not silently change advisor route.                                                         |
| False conformance pass from shallow checks            | Spoofing / Tampering               | Require separate checks for base, streaming, tool-use, usage, and error shape with per-check evidence.                          |
| Provider/model ambiguity in audit                     | Repudiation                        | Record requested alias plus resolved provider/model in real runtime request artifacts and local audit/state artifacts.          |

## Sources

### Primary

- `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/phases/04-provider-routing-and-conformance/04-CONTEXT.md` — locked Phase 4 decisions and boundaries.
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.planning/REQUIREMENTS.md` — ROUT-01 through ROUT-04 and out-of-scope provider fallback.
- `/home/seven/data/coding/projects/seven/agent-team-advisor/CLAUDE.md` — project constraints and stack guidance.
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/policy.example.json` — protected route surfaces.
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/advisor-mode/README.md` — runtime artifact conventions.
- `/home/seven/data/coding/projects/seven/agent-team-advisor/.claude/hooks/advisor-gate.js` — existing runtime gate/request chain to enrich with route metadata.

### External facts

Exact provider/model IDs, gateway env var syntax, and provider-specific Messages API details must be verified during the explicit human/provider-doc checkpoints before implementation locks them. Those checkpoints are now part of the executable plan and close the prior research blocker.

## Metadata

**Confidence breakdown:**

- Project-local architecture: HIGH — locked context and existing hook/policy/runtime artifact architecture define the plan.
- Runtime ROUT-02 wiring: HIGH — concrete integration target is `.claude/hooks/advisor-gate.js` request artifacts plus `.advisor/` audit/state outputs.
- External provider details: MEDIUM — exact provider facts are intentionally gated by human/provider-doc checkpoints before implementation.
- Conformance details: MEDIUM — required behavior categories are locked; exact live request/response shapes are confirmed during 04-02 Task 1.

**Research validity:** Project-local architecture remains valid for Phase 4 execution; external provider details are valid only after the planned pre-flight checkpoints complete.
