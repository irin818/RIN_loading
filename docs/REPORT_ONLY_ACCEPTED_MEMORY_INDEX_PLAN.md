# Report-Only Accepted Memory Semantic Index Plan

Status: future milestone plan. Ultra-Milestone 11 does not index real
`.rin-data` and does not connect semantic retrieval to production context
injection.

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

A future command should require explicit local configuration, for example:

```sh
npm run rin:semantic-accepted-index-report -- --local-data --report-only
```

The command should refuse to run unless it can confirm:

- owner opt-in flag is present
- report-only mode is selected
- local embedding provider is explicitly configured
- provider readiness has passed or produced a safe skipped report
- output path is ignored or temp-only
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
