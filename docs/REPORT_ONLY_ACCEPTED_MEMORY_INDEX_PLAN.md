# Report-Only Accepted Memory Semantic Index Plan

Status: report-only accepted-memory semantic index command implemented in
Super-Milestone 12-14. The command is explicit and disabled by default; it does
not connect semantic retrieval to production context injection.

## Purpose

The next semantic milestone may build a report-only local semantic index over
real accepted memories, but only after explicit owner opt-in. The goal is to
measure whether local embeddings improve accepted-memory recall while preserving
deterministic retrieval as the production baseline.

## Required Boundaries

- The mode must be report-only first.
- The owner must explicitly opt in before any real `.rin-data` is read.
- Only `accepted` memories may be eligible.
- Pending, rejected, archived, raw logs, prompts, and model context snippets must
  remain excluded.
- No semantic candidate may be injected into model context.
- No Console production behavior may run semantic retrieval.
- No server API may expose semantic retrieval as production behavior.
- Deterministic retrieval remains the only production context path.

## Opt-In Shape

The implemented report command requires explicit local configuration:

```sh
npm run rin:semantic-index-report -- --allow-accepted-memory-index --query "local query"
```

Equivalent environment opt-in is:

```sh
RIN_SEMANTIC_ACCEPTED_MEMORY_INDEX=report-only \
RIN_SEMANTIC_INDEX_QUERY="local query" \
npm run rin:semantic-index-report
```

The live local provider variant is separate and still explicit:

```sh
RIN_SEMANTIC_ACCEPTED_MEMORY_INDEX=report-only \
RIN_SEMANTIC_LIVE_PROVIDER=ollama-local \
RIN_SEMANTIC_OLLAMA_EMBEDDING_MODEL=<local-embedding-model> \
RIN_SEMANTIC_INDEX_QUERY="local query" \
npm run rin:semantic-live-index-report
```

The commands refuse or report disabled unless they can confirm:

- owner opt-in flag is present
- report-only mode is selected
- local embedding provider is explicitly configured for live reports
- provider readiness has passed or produced a safe skipped report for live reports
- indexing is in-memory only
- no production integration flag is enabled

## Index Input Policy

Eligible input:

- accepted memory IDs
- accepted memory content used locally for embedding only
- memory type
- owner-reviewed metadata hash only if the embedding policy includes metadata
- updated timestamp

Forbidden input:

- non-accepted memories
- raw conversation prompts
- model context snippets
- raw metadata JSON in reports
- secrets or env values
- unbounded local files outside RIN memory storage

## Report Fields

Reports should use IDs, counts, and safe metadata only:

- provider id
- provider kind
- model id
- vector dimension
- index implementation id
- accepted memory count
- embedded accepted memory count
- skipped memory IDs with safe reasons
- stale candidate IDs
- candidate IDs
- topK and candidate cap
- providerCallCount
- safe error codes
- privacy pass/fail counts
- `productionIntegrationEnabled: false`
- `contextInjectionEnabled: false`
- `fullTextIncluded: false`

Reports must not print full memory text, raw prompts, embedding vectors, raw
metadata JSON, local private paths, stack traces, or env dumps.

## Update/Delete Lifecycle

The report-only index must treat embeddings as derived data:

- accepted create: eligible only after owner acceptance
- content update: old embedding becomes stale
- delete: embedding must be removed or invalidated
- archive: embedding must be excluded
- reject: proposal must never be embedded
- metadata update: re-embed only if metadata participates in the embedding hash
- provider/model/dimension change: rebuild required

## Privacy Gates

Before this mode can merge:

- report output must pass no-full-text tests
- safe error reports must avoid stack traces and paths
- generated index artifacts must be temp-only or ignored
- no artifact may be committed
- optional live provider checks must remain explicit and skippable
- cloud embeddings must remain absent

## Evaluation Gates

Required checks:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:semantic-eval`
- `npm run rin:semantic-readiness`
- report-only accepted-memory index tests over temp fixtures
- `npm run rin:semantic-index-report` default-disabled smoke
- `npm run rin:semantic-live-index-report` default-disabled smoke
- stale/update/delete/archive lifecycle tests
- provider dimension mismatch tests
- repeated deterministic report output tests

## Rollback Gates

Rollback must be trivial:

- disable report-only command/config
- delete temp or ignored derived index artifacts
- keep canonical memory data unchanged
- continue deterministic retrieval unchanged
- pass `npm run rin:memory-eval`
- pass `npm run rin:semantic-readiness`

## Required Tests

- refuses to run without explicit owner opt-in
- refuses non-report-only mode
- indexes accepted memories only
- excludes proposal/rejected/archived memories
- reports candidate IDs only
- does not print full memory text
- detects stale embeddings after content update
- invalidates deleted/archived memories
- fails safely on provider unavailable/timeout/invalid response
- fails safely on vector dimension mismatch
- keeps default checks provider-free
- leaves production retrieval/context/server/UI unchanged

## Implemented Super-Milestone 12-14 Behavior

- Default `npm run rin:semantic-index-report` does not list memories, does not
  read real `.rin-data`, does not call providers, and reports
  `LOCAL_EMBEDDING_DISABLED`.
- Explicit fixture/local mode builds an in-memory index over accepted memories
  only and reports candidate IDs, counts, topK/candidate cap, and
  `providerCallCount`.
- Explicit live mode is isolated in `npm run rin:semantic-live-index-report`;
  it requires accepted-memory index opt-in plus live local provider config and
  reports safe error codes if unavailable.
- Reports never include full memory text, raw query text, raw metadata JSON,
  embedding vectors, local paths, secrets, or stack traces.
- No command changes `retrieveAcceptedMemoriesWithExplanation`,
  `buildModelContext`, conversation runtime, server APIs, or Console behavior.
