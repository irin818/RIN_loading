# RIN v1.0 Readiness Checklist

Status: v1.0 release checklist.

## Required Checks

- `npm run rin:v1-check`
- `npm run rin:full-check`
- `npm run rin:external-model-smoke`

## Required Safety Results

- External provider smoke is skipped by default unless explicitly selected.
- Default `providerCallCount` remains `0`.
- Semantic retrieval remains opt-in and report-only unless explicitly enabled.
- Memory governance remains suggestion-only.
- Tool/MCP boundaries remain default-deny.
- Task autonomy remains finite, checkpointed, and dry-run/report-first.
- Sync remains dry-run only with no cloud sync or automatic overwrite.
- Body/Live2D remains a replaceable interface, not identity.
- Reliability reports do not repair, delete, restore, or hide errors.

## v1.0 Status

RIN v1.0 is stable when the required checks pass on `main` after merge and the
known limitations in `docs/RIN_V1_RELEASE_NOTES.md` remain explicit.
