# Python RIN Core Candidate Report

Status: Packages A-F final candidate validation completed for review.

## Candidate Scope

- Branch: `python-rewrite/main`
- Integration target: `python-rewrite/main`
- Production target: not approved
- Launcher switch: not approved
- TypeScript Core removal: not approved

## Exact Parity

- Python safety guard rejects production `.rin-data` and permits
  `/tmp/rin-python-*`.
- Pydantic contracts serialize and validate known RIN data shapes.
- Read-only storage/profile/database summaries use safe compact output.
- Memory V2 and Context V2 pure fixtures match the approved TypeScript fixture
  behavior covered by migration tests.
- Ollama/Qwen3 adapter defaults preserve `think: false`, local-only defaults,
  safe errors, thinking stripping, and empty-response rejection under mocked
  checks.
- Candidate runtime preserves owner messages on model failure and writes no fake
  RIN reply.
- FastAPI compatibility routes cover readiness, state, profile status,
  conversation create/send/history, and trace status for temp data.
- Package A audit added safe elapsed runtime timing in candidate results.

## Approved Differences

- Python API is an app factory only and is not wired into launchers.
- Python runtime writes only to guarded temp layouts.
- Python preview mode uses `/tmp/rin-python-preview-*` and is not production
  launch.
- Python local chat smoke is skipped by default unless explicitly selected with
  environment variables.
- Python Memory V2 writes currently record candidate-safe trace summaries, not a
  production cutover memory policy.

## Missing Functions

- Production launcher integration.
- Production `.rin-data` migration.
- Production FastAPI binding and operator workflow.
- Full UI replacement or React Console routing to Python.
- Real owner-data write approval.
- TypeScript Core deletion.

## Data Compatibility

- Synthetic temp data validates against Python read/write/runtime/API checks.
- Preview smoke validates temp preview data, API readiness/state, mock
  conversation writes, history, trace status, and production write rejection.
- Read-only copied-data inspection is permitted only after copying to
  `/tmp/rin-python-*`; original data must remain hash-stable.
- Copied-data shadow validation copies source data to `/tmp/rin-python-shadow-*`,
  runs read inspection and optional write simulation on the copy, and verifies
  source DB hash stability.
- Write simulation is limited to safe temp/copy fixtures.
- Copied owner-data read verification passed: original DB hash unchanged,
  copied DB hash unchanged after read-only inspection, schema version 6, and 17
  tables checked. The temporary copy was removed.

## Performance

- No formal performance target is approved yet.
- Current tests validate correctness and deterministic behavior, not throughput.
- Optional live Ollama/Qwen3 smoke required a longer cold-start timeout on this
  machine: 60s timed out, 180s succeeded.
- Package B optional preview local-model smoke succeeded with local `qwen3:4b`
  and 180s timeout.
- Package F optional local Ollama/Qwen3 smoke also succeeded with 180s timeout.

## Rollback

- Stable TypeScript RIN v2.0 remains the production reference.
- No production launcher or main-branch cutover changes are included.
- Rollback remains: continue using TypeScript main and ignore Python integration
  branches.
- Package D dry-run/rehearsal commands simulate migration and rollback only on
  copied/temp data and expose no production apply path.
- Package E adds preview-compatible Console API aliases for `/api/local-state`,
  `/api/conversations`, and `/api/conversations/{id}` on synthetic/temp data.
- Package F final validation passed the full Python gate, repeated candidate
  checks, TypeScript v2 checks, copied-data shadow validation, migration
  dry-run, rollback rehearsal, API contract check, and optional local Ollama
  smoke.
- Package A main-integration audit found PR #72 safe for preview-only main
  integration after final documentation and verification gates.

## Unresolved Risks

- FastAPI TestClient emits an upstream Starlette deprecation warning.
- Runtime candidate is covered with deterministic mock adapters by default.
  Optional local Ollama smoke succeeded once with `qwen3:4b`, but cold-start
  latency remains a risk.
- Production owner-data migration semantics require separate review.
- API compatibility is practical and local-only, not a full Console replacement.
- Durable TypeScript-style timing event tables are not implemented in Python.
- Preview server is local/manual and not integrated with the React Console
  launcher.
- Python does not yet implement the full TypeScript Console memory review API.
- Production cutover, launcher switching, real-data migration, and TypeScript
  Core removal remain blocked pending explicit owner approval.
