# Console Operations Policy

Status: historical Package 4 design lock; superseded in active RIN v2.

The RIN Console may show operational status for local model configuration,
memory, semantic retrieval, decommissioned Agent runtime state, and continuity
readiness. These surfaces must remain read-only unless an existing explicit
local API already performs a scoped owner action.

RIN v2 no longer has active planner, actions, tools/MCP, task autonomy, or
L0-L5 runtime permission scaffolds. Old planner/permission Console references
are historical context only and must not be treated as active feature scope.

## Allowed Surfaces

- local readiness and model configuration status
- memory counts and safe recent memory metadata already exposed by Console
- semantic readiness/configuration status
- decommissioned Agent runtime status and legacy counts only
- backup and restore dry-run readiness
- safe counts, statuses, feature flags, and reason codes

## Forbidden Behavior

- No direct provider calls from browser UI.
- No browser-side semantic retrieval execution.
- No background planner/action execution.
- No secret, token, env dump, full memory text, raw prompt, model context
  snippet, or private file content display.
- No bypass around local server, provider, memory, profile, or storage
  data-integrity boundaries.

Operational status should be derived from local configuration, database counts,
and deterministic local scaffolds only.
