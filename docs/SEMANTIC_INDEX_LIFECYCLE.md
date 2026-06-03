# Semantic Index Lifecycle

Status: design plan. Mega-Milestone 10 implements only an in-memory fixture
vector index for evaluation. No persistent semantic index exists yet.

## Current In-Memory Prototype

The current prototype:

- uses `src/memory/vectorIndex.ts`
- indexes synthetic fixture vectors only
- supports topK, candidate caps, minimum score, and deterministic id tie-breaks
- writes no files
- reads no real `.rin-data`
- is not connected to production retrieval

## Future Persistent Index Options

A future persistent semantic index may live under ignored local data, not source
control. Possible storage forms:

- rebuilt local files under a future ignored semantic cache directory
- SQLite side tables only after a schema/index ADR
- temporary OS directory for report-only experiments

Persistent storage must wait for a dedicated schema/index decision.

## Index Rebuild Policy

Indexes are derived data. They must be rebuildable from canonical accepted
memories and local configuration.

Rebuild is required when any of these change:

- embedding provider id
- embedding model id
- vector dimension
- embedding config version
- memory content hash
- memory status
- memory type
- owner-reviewed metadata hash
- accepted/reviewed timestamp policy

## Memory Create, Update, Delete

Future behavior must preserve slow-variable safety:

- accepted create: eligible for embedding only after owner acceptance
- content update: old embedding becomes stale
- delete: embedding must be removed or invalidated
- archive: embedding must be removed from retrieval
- reject: proposal must never be embedded for retrieval
- metadata update: re-embed only if the future policy includes metadata in the
  embedding source hash

## Status Transitions

Only `accepted` memories can be indexed for retrieval. `proposal`, `rejected`,
and `archived` memories must not appear in semantic candidate expansion. Eval
may include non-accepted fixture candidates only to prove violation detection and
exclusion.

## Stale Embedding Detection

Each indexed item should record:

- memory id
- memory status
- content hash
- memory type
- metadata hash when relevant
- updated timestamp
- embedding provider id
- embedding model id
- vector dimension
- index implementation id

If any recorded value no longer matches source data, the embedding is stale and
must be excluded.

## Privacy And Encryption

Embeddings and vector indexes are private derived data. Future persistent
indexes should be covered by the same or stricter local encryption and sync
policy as memory storage. They should be excluded from logs, PR artifacts,
source control, and default export bundles unless a future bundle design handles
integrity and encryption explicitly.

## Migration Risks

Risks before persistent integration:

- stale vectors reintroducing old memory influence
- deleted memories remaining in derived indexes
- dimension mismatch after model changes
- hidden privacy leakage through index artifacts
- index corruption changing candidate ordering
- accidental production use before eval gates

## Rollback Strategy

Rollback must be trivial:

1. Disable semantic retrieval config.
2. Ignore or delete derived index files.
3. Continue deterministic retrieval unchanged.
4. Run `npm run rin:memory-eval`.
5. Run `npm run rin:semantic-eval` for report-only comparison if needed.

Canonical memory data must not depend on semantic index files.

## Corruption Recovery

Corrupt or unreadable indexes must be treated as unavailable. Production should
fall back to deterministic retrieval, not partially trusted semantic candidates.
The safe recovery path is full rebuild from accepted memories after readiness
and privacy checks pass.

## Deferred Production Integration

Production index integration is deferred until:

- local provider design is approved
- persistent index ADR is approved
- stale/delete/update behavior is tested
- opt-in gates are implemented
- owner can disable semantic retrieval
- deterministic retrieval remains passing
