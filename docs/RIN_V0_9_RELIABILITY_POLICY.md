# RIN v0.9 Reliability Policy

Status: v0.9 design lock.

RIN reliability checks are report-only by default. They may inspect local state,
summarize degraded conditions, and point to manual recovery paths, but they must
not silently repair, delete, overwrite, or hide failures.

## Allowed

- Inspect local manifest and database readiness.
- Run backup dry-run and restore dry-run smoke checks.
- Summarize ops health from existing local reports.
- Report degraded conditions with explicit error codes.

## Forbidden

- Automatic deletion or repair.
- Silent data loss.
- Hidden error swallowing.
- Untested migration repair.
- Restore apply without explicit confirmation and a non-conflicting target.

## Required Defaults

The v0.9 reports must keep:

- `Automatic repair applied: no`
- `Data mutated: no`
- `providerCallCount: 0`
- `Full text included: no`

Ops health must also report `Hidden errors suppressed: no`.
