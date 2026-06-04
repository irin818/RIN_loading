# RIN v0.6 Task And Bounded Autonomy Policy

Status: v0.6 design lock.

RIN task execution must be finite, auditable, and permission-gated. v0.6 adds a
bounded task scaffold and reports only; it does not add background autonomy or
unapproved action execution.

## Allowed

- Define local task objects and task steps.
- Separate planner, executor, and checker functions.
- Dry-run action permissions through the existing permission model.
- Report owner checkpoint requirements.
- Report task audit event counts.

## Forbidden

- Infinite autonomous loops.
- Long-running background task execution.
- Unapproved tool or action use.
- Automatic slow-variable mutation.
- Destructive actions without confirmation.
- Provider calls as part of task execution.

## Required Defaults

`npm run rin:task-smoke` must preserve:

- `Background loop started: no`
- `Executed actions: 0`
- `Mutated memories: 0`
- `providerCallCount: 0`

Any future real task execution must route through explicit owner checkpoints,
permission gates, and audit records.
