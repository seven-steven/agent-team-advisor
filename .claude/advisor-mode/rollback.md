# Advisor Mode Operator Rollback

Advisor Mode recovery is controlled from `.planning/config.json` under `hooks`.

## Modes

### enforce

Use strict enforcement when advisor gates should block until required evidence exists.

```json
{
  "hooks": {
    "advisor_mode": true,
    "advisor_mode_strict": true
  }
}
```

### warning-only

Use warning-only mode when advisor checks should continue to produce advisory context and audit events without blocking ordinary non-critical work.

```json
{
  "hooks": {
    "advisor_mode": true,
    "advisor_mode_strict": false
  }
}
```

### disabled/kill-switch

Use disabled/kill-switch mode only for emergency rollback. This disables Advisor Mode enforcement globally.

```json
{
  "hooks": {
    "advisor_mode": false
  }
}
```

## Layered capability controls

When Advisor Mode is enabled, operators can disable implemented capability classes independently. Missing keys default to enabled.

```json
{
  "hooks": {
    "advisor_mode": true,
    "advisor_mode_strict": true,
    "advisor_mode_capabilities": {
      "advisorConsultation": true,
      "finalReview": true,
      "criticalHumanApproval": true,
      "protectedSurfaces": true
    }
  }
}
```

Implemented capability keys:

- `advisorConsultation`
- `finalReview`
- `criticalHumanApproval`
- `protectedSurfaces`

## Degraded budget behavior

Budget over-limit degraded mode keeps mandatory safety gates active. Non-critical advisor consultation can downgrade to advisory, but final review and critical human approval remain mandatory unless the global disabled/kill-switch is active.

Recovery controls apply to both enforcement surfaces:

- `.claude/hooks/advisor-gate.js` for PreToolUse advisor consultation, critical human approval, and protected-surface gates.
- `.claude/hooks/advisor-final-review-gate.js` for Stop final-review enforcement.

## Protected governance surfaces

Rollback controls are protected governance surfaces. When enforcement is enabled, changes to these paths continue to require protected-surface review:

- `.planning/config.json`
- `.claude/hooks/`
- `.claude/settings.json`
- `.claude/advisor-mode/*.json`

Restore enforcement by setting `advisor_mode: true`, setting `advisor_mode_strict: true`, and re-enabling all capability keys that were changed during rollback.
