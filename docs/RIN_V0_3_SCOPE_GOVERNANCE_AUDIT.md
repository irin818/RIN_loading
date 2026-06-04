# RIN v0.3 Scope And Governance Audit

Status: v0.3-C/D stabilization document.

## Scope

RIN v0.3 completes local assistant workflow scaffolding after the external
provider handoff diagnostics:

- safe local project inspection report
- action audit report reuse
- rollback notes report
- v0.3 aggregate check command
- release notes and known limitations

## External Provider Boundary

RIN remains local-model-first. External providers remain optional fast-variable
diagnostics, fallback, or compatibility adapters only.

Default v0.3 checks must not require API keys and must not call external
providers. `npm run rin:external-model-smoke` remains explicit and reports
`providerCallCount: 0` unless the OpenAI-compatible adapter is selected,
configured, and separately confirmed with `RIN_EXTERNAL_MODEL_SMOKE=allow`.

## Local Project Assistant Boundary

`npm run rin:project-report` is read-only. It reports package script names,
governance file presence, source counts, and excluded generated/local-data
directories. It does not print full file contents, secrets, raw prompts, model
context snippets, or local absolute paths.

## Rollback Notes Boundary

`npm run rin:rollback-notes` reads safe audit event counts and prints rollback
guidance by area. It does not inspect audit payload text, mutate data, delete
files, restore backups, execute actions, or call providers.

## Governance Result

The current project governance still preserves:

- local identity, memory, policy, permissions, audit, and continuity as slow
  variables
- local-model-first architecture
- external providers as optional replaceable reasoning engines
- no model, local or external, as RIN identity source
- no default cloud sync, external calls, planner execution, or memory mutation
