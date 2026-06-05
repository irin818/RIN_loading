# RIN v2.0 Known Limitations

Status: active v2.0 limitations reference.

## Model Runtime

- Default checks use mock/provider-free paths.
- Ollama/Qwen3 live checks are explicit and separate.
- External APIs are optional adapters only and require explicit configuration.
- API keys are not stored in tracked files or local core config.

## Conversation And UI

- No streaming response path is implemented.
- Response-before-persistence is deferred.
- The Console is a local inspection/control surface, not the final desktop body.
- The UI must not call providers directly.

## Memory

- Memory V2 automatic formation is deterministic and local, but production
  accepted-memory retrieval currently uses migrated legacy accepted-memory
  traces, with fallback to legacy accepted memory while migration is incomplete.
- Full Context V2 provider-facing cutover is deferred.
- Semantic retrieval remains report/prototype/opt-in only and is not a default
  production vector database path.
- `/remember` is deprecated legacy proposal-only behavior.

## Agent And Integrations

- Active general-purpose Agent execution is not part of v2.
- Active tools/MCP execution is not part of v2.
- Active planner/task autonomy is not part of v2.
- The L0-L5 runtime permission hierarchy is removed from active v2.
- Future integrations must be separately governed after the conversation/memory
  core is stable.

## Body And Live2D

- Real Cubism `.moc3` runtime loading is not implemented.
- The current body layer is an adapter and visual shell.
- Live2D model development is paused for v2 core stabilization unless a later
  task explicitly resumes it.

## Backup, Sync, And Reliability

- Backup/restore operations are explicit local commands.
- Sync remains report/dry-run only; no cloud sync is implemented.
- Reliability commands are report/smoke checks and do not automatically repair
  or mutate local data.

## Desktop Product

- No native transparent desktop window is implemented.
- No multi-user account system is implemented.
- No SaaS backend is implemented.
