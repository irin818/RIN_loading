# Semantic Retrieval Prototype Boundary

## Purpose

This document defines the safe boundary for a future local semantic retrieval
prototype. It is a plan only. It does not implement semantic retrieval, add
embeddings, add dependencies, add migrations, or connect semantic candidates to
production memory retrieval or context injection.

## Prototype Goals

The first prototype should answer whether local semantic candidates improve
memory retrieval quality enough to justify later integration work.

Goals:

- compare semantic candidates against the existing deterministic baseline
- measure recall and false positives on fixture cases
- test paraphrase and cross-language recall gaps
- verify accepted-only filtering before semantic scoring
- verify no full memory text appears in reports
- verify provider-call count remains zero for default evaluation
- understand local embedding/index lifecycle before any persistent design

## Explicit Non-Goals

- Do not alter `retrieveAcceptedMemoriesWithExplanation`.
- Do not alter `buildModelContext`.
- Do not change conversation runtime behavior.
- Do not inject semantic-only memories into model context.
- Do not add browser UI behavior.
- Do not add a memory editor.
- Do not add a model router.
- Do not add a schema migration.
- Do not add a vector DB dependency.
- Do not add cloud embedding support.

## Allowed Data

The first prototype should use only:

- synthetic fixtures committed to the repository
- temporary in-memory records shaped like accepted memory records
- safe fixture metadata with no real owner-private content
- optionally, a local temp directory created during a future CLI run

Later prototypes may read real accepted memories only after an explicit owner
opt-in flag and only from local `.rin-data`. That later mode must remain
separate from default tests and must never be required by `npm run rin:check`.

## Forbidden Data

The prototype must not use:

- pending, rejected, or archived memories
- raw conversation logs
- raw prompt text from real conversations
- model context snippets from real conversations
- real local databases in default tests
- `.env` files
- API keys, tokens, or credentials
- cloud embedding services by default
- full memory text in reports, logs, PR descriptions, or UI

## Local-Only Requirement

Default semantic evaluation must be provider-free and offline. If a later
prototype uses embeddings, the embedding provider must be local by default.
Acceptable future local options include:

- a local embedding model invoked through a dedicated local embedding boundary
- an explicitly configured local Ollama embedding endpoint if available
- a fixture-only fake embedding provider for deterministic tests

External embedding APIs are out of scope for the prototype. Any future external
embedding path needs a separate ADR and must be opt-in, adapter-isolated, and
excluded from default checks.

## Accepted-Only Requirement

Accepted-only filtering must happen before embedding, indexing, semantic
scoring, or hybrid candidate expansion.

Required behavior:

- proposal memories are excluded
- rejected memories are excluded
- archived memories are excluded
- excluded memories do not appear in semantic reports
- excluded memories are not embedded into prototype indexes
- accepted-only violations fail evaluation immediately

## Fixture-Only First Step

The safest first implementation milestone should be fixture-only:

1. Build deterministic baseline candidates from existing fixture memories.
2. Build semantic candidates from fixture embeddings or a deterministic fake
   semantic provider.
3. Compare IDs and safe metrics.
4. Write no files except optional ignored temp output.
5. Make no production retrieval calls.

This keeps early semantic evaluation reproducible without requiring a real
embedding model.

## Index Lifecycle

Future index files are derived data. They must be rebuildable from accepted
memories and safe local configuration.

For the first real local index prototype:

- default to an OS temp directory or repository-ignored `tmp/`
- never commit index files
- include index implementation ID
- include embedding model ID
- include fixture set or source snapshot ID
- include content hash per indexed memory
- include metadata schema/version for the index format
- support full rebuild
- support safe deletion without touching canonical memories

Persistent index storage must wait for a separate schema/index design.

## Embedding Refresh Strategy

Embeddings become stale when accepted memory content changes. A future prototype
must define a refresh key before using any persisted index.

Recommended refresh key:

- memory ID
- memory status
- memory content hash
- memory type
- relevant owner-reviewed metadata hash
- updated timestamp
- embedding model ID
- embedding configuration version

If any component changes, the embedding is stale and must be recomputed or
excluded from semantic candidates.

## Deletion And Update Behavior

Semantic indexes must not preserve deleted, archived, rejected, or superseded
memory influence.

Required future behavior:

- deleting a memory deletes or invalidates its embedding
- archiving a memory removes it from semantic retrieval
- rejecting a proposal prevents it from being embedded
- updating accepted memory content invalidates the old embedding
- changing embedding model ID invalidates the whole index
- stale embeddings cannot be used for context injection

## Stale Embedding Handling

A stale embedding must be treated as unavailable. It must not be silently used
because stale semantic candidates can reintroduce outdated slow-variable state.

Evaluation should report:

- `staleEmbeddingCount`
- `staleEmbeddingIds`
- `excludedStaleIds`
- `indexRebuildRequired`

Production integration should remain blocked until stale handling is tested.

## Encryption And Privacy Notes

Embeddings and vector indexes can leak information about memory content. Treat
them as local private derived data.

Future persistent indexes should:

- live under ignored local data paths
- be covered by future local-data encryption policy
- be omitted from source control and PR artifacts
- be excluded from default logs
- be rebuilt rather than trusted after import unless the bundle explicitly
  includes index metadata and integrity checks

If encrypted synchronization is added later, semantic index artifacts need the
same or stricter protection as memory storage.

## Expected CLI Shape

No CLI is added in this milestone. A future prototype CLI should be explicit and
separate from production checks.

Possible future command shape:

```sh
npm run rin:semantic-eval -- --fixtures-only
npm run rin:semantic-eval -- --provider=fake-local --report=json
npm run rin:semantic-eval -- --provider=ollama-local --temp-index
```

Default behavior should be fixture-only, provider-free, and real-data-free. Any
real local accepted-memory run should require an explicit opt-in flag such as
`--local-data` and should write only to ignored local output.

## Expected Eval Comparison Shape

Future reports should compare deterministic and semantic outputs without
exposing memory text:

```ts
type SemanticRetrievalComparison = {
  caseId: string;
  categories: string[];
  deterministicInjectedIds: string[];
  semanticCandidateIds: string[];
  hybridCandidateIds: string[];
  expectedInjectedIds: string[];
  falsePositiveIds: string[];
  falseNegativeIds: string[];
  acceptedOnlyPassed: boolean;
  privacyPassed: boolean;
  contextBudgetImpact: {
    deterministicCharacterCount: number;
    hybridCharacterCount: number;
    delta: number;
  };
  providerCallCount: number;
};
```

This is a target report shape, not an implemented exported type.

## Stop Conditions

Stop prototype work before merge if any of these occur:

- semantic candidates change production retrieval output
- semantic candidates are injected into model context
- pending, rejected, or archived memories appear in candidates
- reports expose full memory text
- provider calls occur during default evaluation
- real `.rin-data` is read by default checks
- a dependency or migration becomes necessary
- `npm run rin:memory-eval` fails
- deterministic fixture results regress

## First Follow-Up Implementation Milestone

The next safe milestone should be a fixture-only semantic comparison harness.
It should not add production retrieval behavior. It should produce a local report
that can be reviewed beside the existing deterministic memory eval report.
