# RIN v0.6 Release Notes

Status: v0.6 stabilization document.

## Highlights

- Adds `npm run rin:task-smoke`.
- Adds `npm run rin:task-audit-report`.
- Adds `npm run rin:v0-6-check`.
- Introduces a finite task object/state scaffold with planner/executor/checker
  separation and owner checkpoint reporting.

## Standard Verification

```sh
npm run rin:v0-6-check
```

The v0.6 check includes v0.5 checks plus bounded task smoke and task audit
reports.

## Known Limitations

- No real task executor is enabled.
- No background task loop is started.
- No actions, tools, memory mutations, or provider calls are executed by the task
  smoke path.
- Owner checkpoints are reported only; future confirmed execution requires a
  separate reviewed implementation.
