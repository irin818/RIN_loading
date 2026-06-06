# TypeScript Core Removal Plan

Status: not approved.

This document exists to prevent accidental removal. It is not permission to
delete TypeScript code.

## Preconditions

- Python candidate has been reviewed and explicitly approved.
- Production cutover has completed successfully.
- Real-data migration has been separately reviewed and verified.
- Rollback has been tested after Python launch.
- Owner confirms TypeScript Core no longer serves as production fallback.

## Removal Sequence

1. Freeze TypeScript main as a rollback tag.
2. Confirm no active Codex/Cursor branch depends on TypeScript runtime files.
3. Remove launch references only after Python launchers are stable.
4. Remove TypeScript runtime modules in small reviewable PRs.
5. Keep archived docs describing rollback history and migration rationale.

## Stop Conditions

- Any production data uncertainty.
- Any launcher rollback uncertainty.
- Any unresolved Python parity or API compatibility gap.
- Any owner request to keep TypeScript fallback.
