# Memory Retrieval Ranking Signals

Status: Draft / Implementation planned in this milestone

## Purpose

This note inspects the current memory schema and deterministic retrieval path to
identify which ranking signals are already safe to use, which signals require a
schema proposal, and which signals should remain deferred.

This is analysis only. It does not change retrieval behavior, schema, fixtures,
runtime, UI, or model boundaries.

## Current Schema Findings

Current long-term memory records are stored in the SQLite `memory_items` table.
The current schema exposes:

| Signal | Current status | Notes |
| --- | --- | --- |
| `id` | Present | Stable primary key. Already used in snippets, trace, tie-breaks, and persistence. |
| `status` | Present | `proposal`, `accepted`, `rejected`, or `archived`. Retrieval only considers `accepted`. |
| text/content fields | Present inside `content_json` | Retrieval uses `content.text`, then `content.english`, then `content.chinese` for snippets. |
| type/category | Present as `memory_type` / `memoryType` | Type union includes `raw_log`, `episodic`, `semantic`, `preference`, `procedural`, `goal`, `project`, `reflection`, `identity`. Current `/remember` proposals default to `semantic`. |
| source | Partly present | `source_message_id` links a memory item to a source message when available. There is no richer source kind. |
| `createdAt` | Present | Mapped from `created_at`. Not currently used for ranking. |
| `updatedAt` | Present | Mapped from `updated_at`. Used as a recency tie-break. Review decisions update this timestamp. |
| tags | Missing | No first-class tags table, JSON field, or typed record property. |
| importance | Missing | No owner-reviewed importance field. |
| confidence | Missing for memory items | `ai_state` has a `confidence` placeholder, but `memory_items` does not. |
| accepted/reviewed time | Missing as first-class fields | Acceptance/review is represented indirectly by status and `updated_at`; audit events record review metadata separately. |
| usage stats | Missing | No usage count, last injected time, last matched time, or feedback counters. |
| other metadata | Thin | Audit events contain review facts, but retrieval receives only `MemoryRecord` fields. |

## Existing Usable Signals

These signals exist today and can be used without schema migration:

- Accepted-only status filtering through `status === "accepted"`.
- Deterministic text relevance from normalized token overlap.
- Latin token match count.
- CJK bigram match count.
- Combined overlap count.
- Weighted token score, currently `latinTokenMatchCount * 2 + cjkBigramMatchCount`.
- Memory type/category through `memoryType`.
- Recency through `updatedAt`.
- Stable deterministic tie-break through `id`.
- Snippet length after safe snippet extraction.
- Source message id as metadata, although it is not currently meaningful for ranking.

Important nuance: `memoryType` is already included as extra text when building a
memory token profile. That means a query token such as `preference` can match a
memory whose `memoryType` is `preference`, but there is no explicit type-aware
ranking component, no type score field, and no type-specific trace explanation.

## Missing Signals

These signals do not currently exist as reliable first-class memory metadata:

- Owner-reviewed tags.
- Owner-reviewed importance.
- Owner-reviewed confidence.
- Accepted-at or reviewed-at timestamps separate from `updatedAt`.
- Usage statistics such as match count, injection count, last matched, or last injected.
- Feedback signals about whether an injected memory helped a response.
- Structured source kind beyond `sourceMessageId`.

## Deferred Signals

These signals should remain deferred:

- Semantic embeddings.
- Vector database ranking.
- Learned or model-generated ranking.
- Automatic importance inference.
- Automatic tag generation.
- Any signal that requires exposing full memory text in trace or UI.
- Any signal that writes back to memory without owner review.

## Current Retrieval Behavior

The current retrieval path is:

1. The conversation runtime lists up to 50 accepted memories from SQLite with
   `listMemoryItems(database, { status: "accepted", limit: 50 })`.
2. `retrieveAcceptedMemoriesWithExplanation` ignores non-accepted records and
   does not include them in explanations.
3. `memorySnippetText` extracts a compact snippet from `content.text`, then
   `content.english`, then `content.chinese`; raw metadata is not used.
4. `buildRetrievalTokenProfile` normalizes owner and memory text by:
   - NFKC normalization.
   - Lowercasing.
   - slash, backslash, pipe, hyphen, and underscore splitting.
   - punctuation stripping.
   - conservative plural normalization.
   - English and Chinese stopword filtering.
   - protected technical tokens such as `api`, `model`, `local`, `memory`,
     `ollama`, `qwen3`, `rin`, `agent`, `system`, `semantic`, and `sqlite`.
   - CJK bigram extraction.
5. Memory profiles include `memory.memoryType` as extra token text.
6. `scoreRetrievalOverlap` computes:
   - `latinTokenMatchCount`
   - `cjkBigramMatchCount`
   - `overlapCount`
   - `score = latinTokenMatchCount * 2 + cjkBigramMatchCount`
7. Candidates with zero overlap are skipped as `zero_relevance`.
8. Candidates are sorted by:
   - descending score
   - descending overlap count
   - descending `updatedAt`
   - ascending memory id
9. Retrieval applies `maxInjectedMemories`.
10. Context assembly applies memory-context character budget and whole-context
    budget. Dropped candidates can become `memory_budget_exceeded`.
11. Trace/explanation fields currently include:
    - `memoryId`
    - `matchedKeywords`
    - `overlapCount`
    - `latinTokenMatchCount`
    - `cjkBigramMatchCount`
    - `normalizedQueryTokenCount`
    - `wasInjected`
    - `skippedReason`
    - `snippetLength`
12. Persisted `memoryContext` trace stores safe metadata only. It excludes full
    memory text, model context snippets, and raw prompt text.

## Current Evaluation Coverage

The built-in memory evaluation harness currently covers:

- plural normalization such as `models` to `model`
- API/memory/system token normalization
- slash and hyphen splitting
- CJK bigram matching
- mixed Chinese/English matching
- pending/rejected/archived exclusion
- unrelated memory exclusion
- max count behavior
- memory budget behavior
- privacy checks that prevent full memory text from leaking into trace
- provider isolation with `providerCallCount: 0`

Current gaps:

- No fixture varies `memoryType`; evaluation records are converted to
  `memoryType: "semantic"`.
- No fixture asserts type/category-aware ranking.
- No fixture covers tags, importance, confidence, or usage stats because those
  fields do not exist.
- Limited near-miss coverage for ambiguous technical overlap.

## Candidate Ranking Signals

### Safe To Use Now

These can be considered without schema migration:

- Token score as the primary signal.
- Overlap count as a secondary signal.
- Recency via `updatedAt` as a tie-break.
- Stable id tie-break for deterministic ordering.
- A small explicit type/category component based on `memoryType`, if it remains
  explainable and subordinate to token relevance.

If type/category ranking is implemented, the trace should expose a safe score
component such as `typeMatchBonus` or `categoryMatchBonus`. The evaluation
harness should first support memory type inputs and add cases where type changes
ranking only among otherwise plausible candidates.

### Needs Schema Extension

These require a separate schema proposal before implementation:

- Owner-reviewed tags.
- Owner-reviewed importance.
- Owner-reviewed confidence.
- Accepted/reviewed timestamps separate from `updatedAt`.
- Usage stats such as match count, injection count, or last injected time.
- Source kind beyond `sourceMessageId`.

Tags and importance are especially useful, but they should be owner-reviewed
slow-variable metadata, not inferred automatically from model output.

### Should Defer

These should not be implemented yet:

- Embeddings.
- Vector search.
- Semantic retrieval services.
- Learned ranking.
- Provider-assisted ranking.
- Automatic tag or importance generation.

## Safety Constraints

Any future ranking work must preserve:

- Accepted-only retrieval.
- No pending, rejected, or archived memory injection.
- Deterministic and reproducible ordering.
- Explainable scoring and trace metadata.
- Token score as the primary relevance signal unless a future design explicitly
  changes this.
- Memory and whole-context budget enforcement.
- No full memory text in trace, logs, persisted history, or UI by default.
- No model context snippets or raw prompt text in trace history.
- No schema migration without explicit approval.
- No embeddings/vector database/semantic retrieval.
- No auto-writing or auto-accepting memory.
- No direct provider calls from UI or retrieval.

## Implementation Decision

The current schema exposes a reliable `memoryType` / `memory_type` field, so a
small type-aware ranking phase is safe to consider next. That phase should keep
token overlap as the primary ranking signal, add only a small deterministic type
component, and make the component visible in safe trace metadata.

Milestone 4 will proceed with a constrained type-aware ranking implementation
under these limits:

- Do not add schema fields.
- Do not use tags or importance.
- Do not add embeddings or semantic search.
- Update the evaluation harness so cases can specify `memoryType`.
- Add regression cases proving that type/category ranking is deterministic,
  explainable, budget-safe, and accepted-only.
- Update trace metadata with the new type/category score component.

Tags, importance, confidence, reviewed timestamps, and usage stats should be
handled later through a separate owner-reviewed metadata proposal before any
migration or retrieval use.

## Non-Goals

- Implement ranking behavior.
- Change retrieval scoring.
- Add schema fields or migrations.
- Add tags or importance.
- Add or edit evaluation fixtures in this phase.
- Add embeddings, vector DB, or semantic retrieval.
- Add memory editor UI.
- Change runtime, model, server, context, UI, or database code.
