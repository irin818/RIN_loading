# RIN v0.3 Release Notes

Status: v0.3-C/D stabilization document.

## Highlights

- Adds `npm run rin:project-report` for safe local project assistant inspection.
- Adds `npm run rin:rollback-notes` for audit-count-based rollback guidance.
- Keeps `npm run rin:actions-audit-report` as the action audit report surface.
- Adds `npm run rin:v0-3-check` as the v0.3 aggregate verification command.
- Preserves the external provider smoke command as explicit, skipped by default,
  and provider-free unless selected/configured/confirmed.

## Standard Verification

```sh
npm run rin:v0-3-check
```

The v0.3 check includes v0.2 checks, external provider smoke default behavior,
project report, action audit report, and rollback notes.

## Known Limitations

- Project assistant report is inspection-only and does not edit files.
- Rollback notes are guidance only and do not perform rollback automatically.
- External provider smoke remains diagnostic only, not a runtime default.
- No MCP/tool ecosystem expansion is included in v0.3-C/D.
- No cloud sync, uncontrolled planner execution, or destructive action execution
  is added.
