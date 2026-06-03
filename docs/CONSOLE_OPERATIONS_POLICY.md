# Console Operations Policy

Status: Package 4 design lock.

The RIN Console may show operational status for local model configuration,
memory, semantic retrieval, planner, permissions, and continuity readiness. These
surfaces must remain read-only unless an existing explicit local API already
performs a scoped owner action.

## Allowed Surfaces

- local readiness and model configuration status
- memory counts and safe recent memory metadata already exposed by Console
- semantic readiness/configuration status
- planner and permission scaffold status
- backup and restore dry-run readiness
- safe counts, statuses, feature flags, and reason codes

## Forbidden Behavior

- No direct provider calls from browser UI.
- No browser-side semantic retrieval execution.
- No background planner/action execution.
- No secret, token, env dump, full memory text, raw prompt, model context
  snippet, or private file content display.
- No bypass around local server/provider/action permission boundaries.

Operational status should be derived from local configuration, database counts,
and deterministic local scaffolds only.
