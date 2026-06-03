# Memory Maintenance Policy

Status: Package 3 design lock.

RIN memory maintenance is suggestion-only in v0.1. Maintenance reports may help
the owner notice stale, duplicate, conflicting, or archive-worthy memory records,
but they must not delete, archive, downgrade, merge, or rewrite memory
automatically.

## Allowed Behavior

- Read local memory records through existing repository APIs.
- Report memory IDs, statuses, types, timestamps, counts, and safe reason codes.
- Suggest owner review for stale, duplicate, conflicting, rejected, archived, or
  long-pending memories.
- Keep reports deterministic and provider-free.
- Keep canonical memory data unchanged.

## Forbidden Behavior

- No automatic deletion.
- No automatic archive/downgrade.
- No automatic conflict resolution.
- No model-authored maintenance decisions.
- No provider calls.
- No full memory text, raw prompts, model context snippets, secrets, or local
  paths in reports.

## Review Reasons

Initial safe reason codes:

- `stale_accepted_memory`
- `long_pending_proposal`
- `duplicate_content_candidate`
- `low_confidence_accepted_memory`
- `rejected_memory_retention_review`
- `archived_memory_retention_review`

The owner remains responsible for any actual mutation through the existing memory
review path.
