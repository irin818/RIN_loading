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
- local embedding provider readiness passes
- vector dimension compatibility is verified
- index lifecycle checks pass
- real-data indexing is explicitly enabled by owner config

## Evaluation Gates

Required checks:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:semantic-eval`
- future local embedding eval over temp data
- future stale/delete/update index tests
- future report-only live index comparison

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
- cloud embeddings remain excluded by default
- index rebuild/delete/update behavior is tested
- rollback to deterministic retrieval is trivial

## Local-Only Provider Requirement

The default production path, if ever enabled, must use a local embedding provider.
Cloud embeddings require a separate ADR and explicit opt-in; they must never be
the default semantic retrieval path.
