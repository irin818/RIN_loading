# Semantic Retrieval Opt-In Gates

Status: future production gate checklist. Mega-Milestone 10 does not enable
production semantic retrieval.

## Default Disabled Behavior

Semantic retrieval must default to disabled. Absence of semantic config must
mean:

- deterministic retrieval remains the only production retrieval path
- no semantic index is built
- no embedding provider is called
- no real `.rin-data` is indexed
- no semantic candidates are injected into context
- accepted-memory index and hybrid retrieval report commands return disabled
  reports unless their explicit report-only opt-ins are present

## Required Config Flags

Future opt-in should require explicit local config fields such as:

- semantic retrieval enabled
- provider id
- embedding model id
- index implementation id
- max semantic candidates
- zero-overlap policy
- report-only versus context-injection mode
- owner acknowledgement timestamp

No production code should infer opt-in from installed tools or available local
models.

## Owner Opt-In Requirement

The owner must explicitly enable semantic retrieval. The UI or CLI should state:

- embeddings are derived private data
- indexes may reveal information about memories
- only accepted memories are eligible
- semantic retrieval can be disabled
- deterministic retrieval remains available as rollback

## Readiness Gates

Before opt-in can affect production:

- `npm run rin:semantic-readiness` passes
- default semantic readiness reports `providerCallCount: 0`
- default semantic readiness reports the local provider scaffold as disabled
- temp fixture embedding evaluation reports candidate IDs only
- local embedding provider readiness passes
- vector dimension compatibility is verified
- index lifecycle checks pass
- real-data indexing is explicitly enabled by owner config

Ultra-Milestone 11 adds `npm run rin:semantic-live-readiness` as an explicit
optional live-local readiness probe. Passing or skipping this command does not
enable production retrieval. A future production opt-in must still require a
separate accepted-memory report-only index gate before any context injection.

Super-Milestone 12-14 adds the accepted-memory report-only index and hybrid
candidate report commands:

- `npm run rin:semantic-index-report`
- `npm run rin:semantic-live-index-report`
- `npm run rin:hybrid-retrieval-report`
- `npm run rin:semantic-trace-list`
- `npm run rin:semantic-trace-read`

Default readiness reports these commands as available but disabled, with memory
listing disabled and `providerCallCount: 0`.

Package 2 introduces two additional opt-in gates:

- semantic report trace recording, which may persist sanitized report traces to
  existing audit storage only when explicitly requested by a report command
- semantic context candidate expansion, controlled by
  `RIN_SEMANTIC_CONTEXT=off | candidate-expansion`

Absence of these flags means no semantic trace write and no semantic context
injection. Invalid semantic context config must fall back safely to `off`.

## Evaluation Gates

Required checks:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:semantic-eval`
- `npm run rin:semantic-readiness`
- `npm run rin:semantic-index-report`
- `npm run rin:hybrid-retrieval-report`
- `npm run rin:semantic-trace-list`
- `npm run rin:semantic-trace-read`
- local embedding eval over temp fixture data
- report-only accepted-memory index tests
- report-only live index comparison tests
- report-only hybrid candidate expansion tests
- future stale/delete/update persistent-index tests

## Privacy Gates

Semantic retrieval cannot reach production if reports expose:

- full memory text
- raw prompt text
- model context snippets
- raw metadata JSON
- embedding vectors
- secrets or env dumps
- real local paths

Allowed output remains IDs, category names, counts, safe score fields, and
provider-call counts.

Persisted semantic traces and runtime semantic context stats must additionally
exclude embedding vectors, full memory text, raw prompts, model context snippets,
raw metadata JSON, secrets, environment dumps, and local private paths.

## Rollback Gates

Rollback must be tested before production use:

- disable semantic config
- skip semantic index
- run deterministic retrieval only
- preserve canonical memory data
- pass `npm run rin:memory-eval`
- delete derived index files safely

## Production Integration Forbidden Until

Production semantic retrieval remains forbidden until:

- deterministic baseline remains passing
- semantic eval remains passing
- accepted-only behavior is verified
- zero-overlap policy is explicit
- full safe trace is available
- owner can disable semantic retrieval
- local-only provider is implemented and reviewed
- report-only accepted-memory indexing has passed explicit opt-in gates
- report-only hybrid candidate expansion has passed explicit opt-in and
  accepted-only gates
- opt-in semantic context expansion has passed strict budget, cap, traceability,
  and rollback gates
- cloud embeddings remain excluded by default
- index rebuild/delete/update behavior is tested
- rollback to deterministic retrieval is trivial

## Local-Only Provider Requirement

The default production path, if ever enabled, must use a local embedding provider.
Cloud embeddings require a separate ADR and explicit opt-in; they must never be
the default semantic retrieval path.
