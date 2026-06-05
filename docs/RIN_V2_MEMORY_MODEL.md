# RIN v2.0 Memory Model

Status: active v2.0 memory reference.

## Principles

- Raw conversation messages are canonical local records.
- Forgetting reduces retrieval priority; it does not delete raw history.
- Models cannot directly overwrite memory, profiles, or identity.
- Memory reports must avoid full private text by default.
- Memory behavior is deterministic and provider-free unless an explicitly
  separate live-model task says otherwise.

## Raw Records

Conversation messages remain in SQLite as raw local history. Memory V2 trace
tables reference source messages or legacy memory IDs instead of copying full
raw message text into new tables.

## Short-Term Memory

Short-term memory is a rolling five-hour query over raw conversation messages.
The report includes IDs, roles, timestamps, and character counts. It preserves
the latest Owner message and avoids duplicating that message as both current
input and short-term history.

## Long-Term Memory

Legacy reviewed memory records remain in `memory_items`.

Memory V2 adds:

- `memory_v2_trace_sources`
- `memory_v2_traces`
- `memory_v2_trace_signals`
- `memory_v2_retrieval_events`

Accepted legacy memories can be mapped into Memory V2 retrieval-candidate
traces through the explicit migration commands.

## Formation And Retention

The deterministic Memory V2 engine analyzes visible message text with bounded
pattern-based signals such as preference, project, contradiction, daily, low
signal, reinforcement, and decay.

The retention formula is:

```text
baseScore * exp(-ageHours / stabilityHours)
```

Trace decisions include:

- promoted
- reinforced
- weakened
- ignored

This is biologically inspired scoring, not a scientific simulation of human
memory.

## Production Retrieval

Production accepted-memory retrieval uses Memory V2 migrated legacy traces when
legacy migration is complete. If migration is incomplete, runtime retrieval
falls back to legacy accepted memories so owner-reviewed memories are not
silently dropped.

## Legacy Migration

Dry-run and status are safe default checks:

```sh
npm run rin:memory-v2-migration-dry-run
npm run rin:memory-v2-migration-status
```

Apply is explicit:

```sh
npm run rin:memory-v2-migration-apply
```

Apply is additive and idempotent. It does not mutate raw messages, profiles, or
legacy accepted memory records.

## `/remember`

`/remember` remains a deprecated legacy proposal-only path. It does not directly
accept long-term memory and does not make memory model-editable.
