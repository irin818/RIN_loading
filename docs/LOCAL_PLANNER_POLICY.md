# Local Planner Policy

Status: Package 3 design lock.

The local planner is a finite planning and self-check scaffold. It is not an
autonomous background agent and it must not execute tools or actions without the
permission layer.

## Allowed Behavior

- Build deterministic local fixture plans.
- Track plan step IDs, statuses, and safe reason codes.
- Run a bounded self-check loop with a configured maximum step count.
- Produce a report suitable for local smoke checks.
- Stay provider-free by default.

## Forbidden Behavior

- No infinite or background loops.
- No hidden tool execution.
- No provider or network calls by default.
- No real OS/file/network/system actions.
- No automatic memory mutation.
- No bypassing action permissions.
- No secrets, raw prompts, full memory text, model context snippets, or local
  paths in reports.

## Initial Step Statuses

- `pending`
- `ready`
- `blocked`
- `completed`

The planner smoke command should remain deterministic and fixture-only until a
future milestone explicitly connects planner output to real permission-gated
actions.
