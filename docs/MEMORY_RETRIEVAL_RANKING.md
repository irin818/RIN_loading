# Memory Retrieval Ranking Signals

Status: Metadata-aware retrieval policy defined for Mega-Milestone 6

## Purpose

This note records the current memory schema, deterministic retrieval path, the
small type-aware ranking signal implemented in Milestone 4, and the
owner-reviewed metadata ranking policy for Mega-Milestone 6. It also identifies
which signals still require a schema proposal and which signals remain deferred.

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
| tags | Present as owner-reviewed metadata | Stored in `memory_metadata` side-table JSON. Mega-Milestone 6 may use normalized query/tag overlap as a small bounded ranking signal only after content overlap exists. |
| importance | Present as owner-reviewed metadata | Bounded owner-reviewed metadata. Mega-Milestone 6 may use `high` as a small bounded bonus only after content overlap exists. |
| confidence | Present as owner-reviewed metadata | Bounded owner-reviewed metadata. Mega-Milestone 6 may use `low` only to dampen metadata bonus; default remains neutral. |
| accepted/reviewed time | Present as metadata timestamps | `acceptedAt` / `reviewedAt` are stored for metadata/review visibility. Retrieval still uses `updatedAt` tie-breaks. |
| usage stats | Missing | No usage count, last injected time, last matched time, or feedback counters. |
| other metadata | Thin | Metadata includes a safe owner-provided source string; no richer source kind exists yet. |

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

Important nuance: before Milestone 4, `memoryType` was included as extra text
when building a memory token profile. Milestone 4 replaced that implicit behavior
with an explicit, traceable type component that can only add a small bonus after
memory content already has token overlap.

## Missing Signals

These signals do not currently exist as reliable first-class memory metadata or
ranking-ready signals:

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
5. Memory profiles are built from snippet text only; `memoryType` is no longer
   treated as ordinary memory text.
6. `scoreRetrievalOverlap` computes the base token score:
   - `latinTokenMatchCount`
   - `cjkBigramMatchCount`
   - `overlapCount`
   - `tokenScore = latinTokenMatchCount * 2 + cjkBigramMatchCount`
7. `scoreTypeSignalMatch` maps normalized query tokens and selected CJK bigrams
   to the existing `MemoryType` union. If the memory has content overlap and its
   type has at least one matched type signal, retrieval adds
   `typeMatchBonus = 1`; otherwise the bonus is `0`.
8. Candidates with zero content overlap are skipped as `zero_relevance`, even if
   the query has a type signal matching the memory's type.
9. Candidates are sorted by:
   - descending final score (`tokenScore + typeMatchBonus`)
   - descending token score
   - descending overlap count
   - descending type match bonus
   - descending `updatedAt`
   - ascending memory id
10. Retrieval applies `maxInjectedMemories`.
11. Context assembly applies memory-context character budget and whole-context
    budget. Dropped candidates can become `memory_budget_exceeded`.
12. Trace/explanation fields currently include:
    - `memoryId`
    - `memoryType`
    - `matchedKeywords`
    - `overlapCount`
    - `latinTokenMatchCount`
    - `cjkBigramMatchCount`
    - `normalizedQueryTokenCount`
    - `typeMatchBonus`
    - `matchedTypeSignals`
    - `wasInjected`
    - `skippedReason`
    - `snippetLength`
13. Persisted `memoryContext` trace stores safe metadata only. It excludes full
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
- type bonus tie-breaking between similarly relevant accepted memories
- zero-overlap type-only memory exclusion
- stronger token relevance beating weaker type bonus
- non-accepted memory exclusion even with a good type signal
- CJK plus type signal overlap
- type trace privacy checks

Remaining gaps:

- Metadata shape is covered only as a no-ranking readiness case. Future
  metadata-aware ranking still needs dedicated fixtures.
- No fixture covers usage stats because those fields do not exist.
- Limited near-miss coverage for ambiguous technical overlap.

## Candidate Ranking Signals

### Safe To Use Now

These can be considered without schema migration:

- Token score as the primary signal.
- Overlap count as a secondary signal.
- Recency via `updatedAt` as a tie-break.
- Stable id tie-break for deterministic ordering.
- A small explicit type/category component based on `memoryType`; this is now
  implemented as `typeMatchBonus`.
- Small owner-reviewed metadata components defined by the Mega-Milestone 6
  policy below.

### Needs Schema Extension

These require a separate schema proposal before implementation:

- Usage stats such as match count, injection count, or last injected time.
- Source kind beyond `sourceMessageId`.

Tags and importance are especially useful, but their ranking influence must be
owner-reviewed, bounded, and protected by evaluation fixtures rather than inferred
automatically from model output.

### Should Defer

These should not be implemented yet:

- Embeddings.
- Vector search.
- Semantic retrieval services.
- Learned ranking.
- Provider-assisted ranking.
- Automatic tag or importance generation.
- Metadata-aware ranking outside the bounded Mega-Milestone 6 policy.

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

## Mega-Milestone 6 Metadata Ranking Policy

Metadata-aware retrieval may use only owner-reviewed metadata already stored on
accepted memory records. It must remain deterministic, local, and explainable:

- Token relevance is primary. Ranking must keep token score ahead of metadata
  effects, and metadata must not cause a weak lexical match to outrank a
  materially stronger lexical match.
- Zero lexical overlap remains excluded. Tags, importance, confidence, source,
  and timestamps must not inject a memory whose content has no token or CJK
  bigram overlap with the owner query.
- Tags may add a small bonus only when normalized query tokens match
  owner-reviewed tags. The tag contribution is capped.
- Importance may add a small bounded bonus for `high` importance only after
  lexical overlap exists. `normal` and `low` are neutral.
- Confidence may dampen metadata effects when confidence is `low`. `medium` and
  `high` are neutral for now so confidence does not become a second importance
  field.
- Source is trace/explanation-only and has no ranking effect.
- `acceptedAt` and `reviewedAt` are trace/explanation-only for now and do not
  change primary score or recency ordering.
- Total metadata bonus is capped and must be visible in trace fields such as
  `matchedTags`, `tagMatchBonus`, `importanceBonus`, `confidenceAdjustment`,
  `metadataBonus`, and `metadataSignals`.
- Trace must not expose full memory text, raw prompt text, model context
  snippets, or raw metadata JSON.
- Evaluation fixtures must guard tag matching, zero-overlap exclusion, bounded
  importance, confidence damping, token dominance, non-accepted exclusion,
  privacy, and old/no-metadata neutrality.

## Implementation Decision

The current schema exposes a reliable `memoryType` / `memory_type` field, so
Milestone 4 implements a constrained type-aware ranking component under these
limits:

- Do not add schema fields.
- Do not use tags or importance.
- Do not add embeddings or semantic search.
- Keep token relevance primary with `tokenScore = latinTokenMatchCount * 2 +
  cjkBigramMatchCount`.
- Add only `typeMatchBonus = 1` when a deterministic query type signal matches
  an accepted memory's existing `memoryType`.
- Keep `typeMatchBonus = 0` for zero-overlap memory content so type alone cannot
  inject a memory.
- Preserve accepted-only filtering, context budgets, recency tie-breaks, and
  stable id tie-breaks.
- Expose only safe trace metadata: `memoryType`, `typeMatchBonus`, and
  `matchedTypeSignals`.
- Protect the behavior with `npm run rin:memory-eval` fixtures.

Tags, importance, confidence, reviewed timestamps, and usage stats should be
handled later through a separate owner-reviewed metadata proposal before any
migration or retrieval use.

## Non-Goals

- Add schema fields or migrations.
- Add tags or importance.
- Add embeddings, vector DB, or semantic retrieval.
- Add memory editor UI.
- Change model provider boundaries or the default adapter.
