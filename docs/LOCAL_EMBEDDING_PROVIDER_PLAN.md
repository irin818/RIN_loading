# Local Embedding Provider Plan

Status: design plan for future local-only semantic retrieval.

Mega-Milestone 10 adds a fixture/mock embedding provider and a disabled local
embedding provider scaffold. It does not add a real embedding model dependency,
does not call Ollama, does not call external providers, and does not connect
semantic retrieval to production context injection.

## Provider Boundary Shape

Future embedding providers should implement a narrow local boundary:

- provider id
- provider kind
- vector dimension
- input memory or query text under explicit owner-approved mode
- output vector
- timeout and structured error metadata
- provider-call count for audit

The current implemented provider is `fixture-mock-local-embedding`. It accepts
fixture-only semantic terms, produces deterministic vectors, and reports
`providerCallCount: 0`. It is a test/prototype provider, not a semantic model.

## Possible Local Providers

### Fixture Mock Provider

Current status: implemented for tests and reports only.

- deterministic
- no dependencies
- no model calls
- no real memory text
- no `.rin-data`
- used only by `npm run rin:semantic-eval` and
  `npm run rin:semantic-readiness`

### Future Ollama Embedding Endpoint

Current status: not implemented.

This may be considered only if a local Ollama embedding endpoint is explicitly
available and the owner opts in. It must use a dedicated embedding boundary; the
chat adapter must not be reused implicitly as an embedding provider.

Required future behavior:

- disabled by default
- explicit provider/model config
- timeout and retry policy
- vector dimension validation
- no cloud fallback
- no production retrieval integration until eval gates pass

### Future Local Embedding Process

Current status: not implemented.

A future local process may be acceptable if it is installed locally, uses local
model files, has bounded resource behavior, and produces reproducible vectors
with stable model/version metadata.

## Cloud Embeddings

Cloud embeddings remain deferred and rejected by default because they can send
memory text or derived private content outside the local machine. Any future
external embedding path needs a separate ADR, explicit opt-in, adapter
isolation, secret handling, retention review, and exclusion from default checks.

## Readiness Checks

Default readiness must not call providers. It should report:

- fixture prototype available
- local embedding provider disabled
- production semantic retrieval disabled
- vector DB absent
- real `.rin-data` indexing disabled
- provider-call count `0`

If a real provider is later enabled explicitly, readiness must check availability
without indexing real memory by default.

## Timeout And Errors

Future real local providers must produce structured errors:

- unavailable runtime
- missing model
- timeout
- invalid vector dimension
- invalid provider response
- unsupported configuration

Errors must be reportable without stack traces, secrets, full memory text, or
local private paths.

## Vector Dimension Compatibility

Every index must record:

- provider id
- model id
- vector dimension
- embedding configuration version
- fixture set or memory snapshot id

Vectors from different provider/model/dimension combinations must not be mixed.

## Privacy Constraints

Full memory text may be used by a future local embedding provider only after
explicit owner opt-in. It must not appear in reports, traces, logs, PR
descriptions, or UI. Reports should use IDs, counts, safe score fields, and
status values.

## Model Replacement Strategy

Changing embedding model id, provider id, dimension, or embedding config version
invalidates the index. Future persistent indexes should be rebuilt rather than
silently reused.

## Testing Strategy

Before any real provider affects production retrieval:

- fixture semantic eval must pass
- deterministic memory eval must pass
- provider readiness must pass
- vector dimension mismatch tests must pass
- stale index tests must pass
- delete/update/archive tests must pass
- privacy/no-full-text tests must pass
- rollback to deterministic retrieval must be tested

## Non-Goals

- No real embedding provider in Mega-Milestone 10.
- No cloud embedding provider.
- No vector database dependency.
- No schema migration.
- No real `.rin-data` indexing.
- No production context injection.
