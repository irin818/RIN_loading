# ADR-0002: Local Semantic Memory Retrieval Boundary

## Status

Proposed.

## Context

RIN's accepted memories are slow variables. They can influence fast model
context only through bounded, auditable, deterministic retrieval and context
assembly. Current production retrieval is deterministic and local: it filters
for accepted memories, scores normalized lexical overlap, applies small
type-aware and owner-reviewed metadata-aware bonuses only after content overlap,
and records safe `memoryContext` trace metadata without full memory text.

Semantic retrieval may eventually help with paraphrase recall, cross-language
matches, and memories whose wording differs from the current owner message. It
also introduces new risks: opaque ranking, embedding model drift, index
staleness, privacy leakage, dependency bloat, and accidental replacement of the
current deterministic baseline before evaluation proves the value.

This ADR defines the boundary for future local semantic memory retrieval. It
does not implement semantic retrieval and does not change current retrieval
behavior.

## Decision

RIN should prepare for semantic retrieval, but production retrieval remains the
existing deterministic accepted-memory path until a later milestone proves a
local, optional, evaluated semantic path.

Semantic retrieval must follow these rules:

- Deterministic retrieval remains the production baseline.
- Semantic retrieval must be local-first and optional.
- Semantic retrieval must not directly replace deterministic retrieval in the
  first implementation phases.
- Early semantic work may only run offline comparisons or add candidate IDs for
  evaluation, not inject semantic-only memories into model context.
- Accepted-only filtering remains mandatory before semantic scoring, indexing,
  evaluation, or candidate expansion.
- Owner-reviewed metadata remains authoritative for metadata ranking.
- No cloud embeddings are allowed by default.
- No provider calls for embeddings are allowed unless a later explicit ADR or
  design approves an isolated optional provider boundary.
- No full memory text may leave the local machine.
- Semantic scores must be explainable enough for evaluation reports to show why
  a candidate was considered without exposing full memory text.

## Non-Goals

- Do not add embeddings in this milestone.
- Do not add a vector database or vector index dependency in this milestone.
- Do not connect semantic retrieval to `retrieveAcceptedMemoriesWithExplanation`.
- Do not connect semantic retrieval to context injection.
- Do not add a schema migration.
- Do not add UI behavior.
- Do not add a model router.
- Do not call Ollama, local models, or external providers from evaluation.
- Do not use real `.rin-data` during design validation.

## Constraints

### Local-First

The embedding model, index files, evaluation fixtures, and any future persistent
semantic artifacts must remain under local owner control. Cloud services may not
be part of the default semantic path.

### Slow Variable Safety

Semantic retrieval must not write to memory, accept proposals, infer trusted
metadata, or change owner-reviewed metadata. It can only read accepted memories
and produce candidate rankings until a later reviewed design expands the scope.

### Accepted-Only Filtering

Pending, rejected, and archived memories must never be embedded for retrieval
unless a future migration explicitly defines a safe cleanup or archival
strategy. The first semantic prototype should build indexes only from fixture
accepted memories.

### Privacy

Full memory text may be used locally to compute embeddings only when the owner
has explicitly opted into a local embedding prototype. It must not be printed in
reports, traces, logs, PR descriptions, or UI. Reports should use memory IDs,
short IDs, category names, aggregate counts, and safe score fields.

### Reproducibility

Semantic retrieval must not become part of production behavior until evaluation
can be reproduced locally. Evaluation reports need to include the embedding
runtime ID, embedding model ID, index implementation ID, fixture set version,
and deterministic baseline output for comparison.

## Options Considered

### 1. No Semantic Retrieval Yet

Keep the deterministic accepted-memory path as the only retrieval implementation.

Pros:

- Lowest risk.
- Fully reproducible.
- No new dependencies, migrations, or privacy surface.
- Keeps current `npm run rin:memory-eval` meaningful.

Cons:

- Limited paraphrase recall.
- Limited concept-level matching when wording differs.
- No evidence yet about whether local embeddings help RIN's memory quality.

Decision: use this as the production state after this ADR.

### 2. Local Embedding Model Plus Local Vector Index

Use a local embedding model and a local index implementation to produce semantic
candidate IDs.

Pros:

- Preserves local-first control.
- Can be evaluated offline against current fixtures.
- Can later support hybrid retrieval without cloud dependency.

Cons:

- Adds model and index lifecycle complexity.
- Requires stale embedding handling for updates/deletes.
- Requires careful dependency and storage review.
- Requires evaluation for false positives and privacy.

Decision: acceptable only as a later optional prototype, initially fixture-only
or temp-index only.

### 3. Ollama Embedding Endpoint If Available And Local

Use a local Ollama embedding endpoint when explicitly configured.

Pros:

- Fits the existing local-model-first direction if the endpoint is available.
- Avoids cloud embeddings.
- May reuse the owner's local model runtime operational model.

Cons:

- Embedding APIs and model availability may vary.
- Must not reuse chat adapter assumptions without an explicit embedding
  boundary.
- Still requires index lifecycle and evaluation.

Decision: acceptable as a future optional local embedding provider only behind a
separate design boundary. Do not call it from current eval.

### 4. SQLite FTS / BM25 As Intermediate Lexical Improvement

Use SQLite full-text search or BM25 as an intermediate retrieval comparison.

Pros:

- Local and mature.
- Easier to explain than dense vectors.
- May improve lexical recall before embeddings.
- Can sometimes use SQLite without a separate vector dependency.

Cons:

- Still lexical, not semantic.
- Requires schema/index design if persisted.
- Needs evaluation against current deterministic retrieval.

Decision: useful intermediate option. Treat it as lexical retrieval work, not
semantic retrieval, and gate it separately.

### 5. Hybrid Retrieval: Deterministic Baseline Plus Semantic Candidate Expansion

Keep deterministic retrieval as baseline and use semantic retrieval only to add
candidate IDs for comparison or later bounded reranking.

Pros:

- Preserves known-safe baseline.
- Makes semantic value measurable.
- Supports conservative rollout.
- Lets evaluation detect semantic false positives before context injection.

Cons:

- More complex reporting.
- Requires clear merge rules and budget behavior.
- Needs strong pass/fail gates before production use.

Decision: recommended future production path after offline semantic comparison
is stable.

### 6. Cloud Embeddings

Use hosted embedding APIs.

Pros:

- Strong models and simpler local setup.

Cons:

- Sends memory text or derived content outside the local machine.
- Conflicts with local-first defaults.
- Introduces secret, billing, provider, retention, and policy risk.
- Makes reproducibility depend on external services.

Decision: rejected/deferred by default. Only a later explicit design may allow
cloud embeddings as an opt-in expert path, and never as the default.

## Recommended Staged Path

1. Keep production retrieval unchanged. Completed by this ADR milestone.
2. Define a fixture-only semantic comparison report that cannot inject memories
   into model context. Completed by Mega-Milestone 9 through
   `npm run rin:semantic-eval`.
3. Prototype a local-only embedding/index adapter using temp fixtures and safe
   reports. Ultra-Milestone 10 completes the fixture/mock in-memory readiness
   layer for this stage without real `.rin-data`, real providers, dependencies,
   or production integration.
4. Compare deterministic, semantic, and hybrid candidate IDs against existing
   memory eval fixtures plus new paraphrase fixtures. Ultra-Milestone 10 extends
   this comparison with fixture/mock embedding candidates, topK/candidate caps,
   tie-break coverage, no-candidate cases, and semantic readiness reporting.
5. Add stale-index, delete, update, and privacy tests before any persistent
   index design.
6. If offline results are stable, propose a schema/index ADR for persistent
   local artifacts.
7. Only after evaluation is stable, consider a disabled-by-default hybrid
   candidate expansion path.
8. Only after hybrid candidate expansion is proven safe, consider whether
   semantic candidates may influence context injection.

## Evaluation Plan

Semantic comparison must report both the current deterministic output and the
semantic candidate output. Minimum fields:

- `caseId`
- `categories`
- `deterministicInjectedIds`
- `semanticCandidateIds`
- `hybridCandidateIds`
- `expectedInjectedIds`
- `falsePositiveIds`
- `falseNegativeIds`
- `acceptedOnlyPassed`
- `privacyPassed`
- `contextBudgetImpact`
- `providerCallCount`

Metrics:

- recall on expected accepted memories
- false positive count
- zero-overlap semantic candidate count
- accepted-only violation count
- privacy violation count

Mega-Milestone 9 implements this report shape for fixture-only semantic
candidate annotations. It remains provider-free and report-only; it does not add
embeddings, vector indexes, runtime integration, context injection, schema
migrations, or real `.rin-data` access.

Ultra-Milestone 10 extends the report with deterministic fixture/mock embedding
prototype candidates and an in-memory vector index. The implementation still
uses synthetic fixtures only, reports `providerCallCount: 0`, and keeps
production semantic retrieval disabled.
- context budget impact
- deterministic regression count

Pass/fail rules must be conservative. A semantic prototype is not eligible for
production integration if it introduces accepted-only violations, privacy
violations, uncontrolled context growth, or worse deterministic fixture results.

## Privacy And Security Analysis

Semantic retrieval can create privacy risk even when reports omit memory text,
because embeddings may encode private facts. A future prototype must:

- keep embeddings local
- keep index files local
- avoid cloud embedding calls by default
- avoid printing full memory text
- avoid logging raw embedding vectors unless a debug-only local file is
  explicitly requested and ignored
- delete embeddings when memories are deleted or archived
- refresh embeddings when accepted memory content changes
- treat index files as local private data, not source artifacts

If encryption is added later, semantic index files should be covered by the same
local-data encryption and export/import policy as other private RIN state.

## Rollback Strategy

Semantic retrieval must be removable without affecting canonical memory data.
The index is derived data and should be rebuildable from accepted local memories.

Rollback requirements:

- Disable semantic retrieval with a local feature flag or absent config.
- Delete temp or persistent index files without deleting memories.
- Fall back to deterministic retrieval without behavior change.
- Keep deterministic `npm run rin:memory-eval` passing before and after
  rollback.
- Never require schema rollback for early fixture-only prototypes.

## Open Questions

- Which local embedding model is small, stable, multilingual enough, and
  practical on the owner's hardware?
- Should embeddings use a dedicated adapter boundary separate from chat model
  adapters?
- Should the first persistent index be SQLite FTS/BM25, a local vector index, or
  a file-based derived artifact?
- How should embeddings participate in encrypted bundle export/import?
- What minimum paraphrase and cross-language fixture set is required before a
  hybrid path can be enabled?
- How should semantic score explanations be displayed without creating false
  authority or exposing sensitive content?
