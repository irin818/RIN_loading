# Memory Retrieval Evaluation Plan

## Purpose

This document defines how future semantic retrieval prototypes should be
compared against RIN's current deterministic accepted-memory retrieval. It is a
design plan only. It does not implement semantic retrieval, add embeddings, add
dependencies, change current fixtures, or alter production retrieval behavior.

## Current Evaluation Harness

The current harness is `npm run rin:memory-eval`, implemented through
`src/memory/evaluation.ts` and in-memory fixtures. It is deterministic,
provider-free, real-data-free, and protects the current production memory
injection path.

Current successful output is expected to include:

- `Total: 29`
- `Passed: 29`
- `Failed: 0`
- `providerCallCount: 0`
- category-level pass/fail lines

Current fixture categories include:

- `lexical`
- `cjk`
- `type-aware`
- `metadata-aware`
- `privacy`
- `budget`
- `non-accepted`
- `trace`
- `token-dominance`
- `zero-overlap`

The current harness validates expected injected IDs, expected excluded IDs,
matched tokens, type signals, metadata signals, skip reasons, memory-context
budget behavior, trace privacy, and provider isolation.

## Semantic Comparison Scope

Semantic comparison must initially be offline and report-only. It must not
change:

- `retrieveAcceptedMemoriesWithExplanation`
- `buildModelContext`
- conversation runtime behavior
- persisted `memoryContext` schema
- Console UI behavior
- default adapter configuration
- package dependencies

The first comparison harness should use fixture data only. Real local accepted
memory comparison requires a later explicit opt-in CLI mode.

## Proposed Comparison Fields

Future semantic comparison results should include safe IDs and aggregate fields
only:

- `caseId`
- `categories`
- `deterministicInjectedIds`
- `semanticCandidateIds`
- `hybridCandidateIds`
- `expectedInjectedIds`
- `falsePositiveIds`
- `falseNegativeIds`
- `privacyCheck`
- `acceptedOnlyPassed`
- `providerCallCount`
- `zeroOverlapSemanticCandidateIds`
- `contextBudgetImpact`
- `semanticRuntimeId`
- `semanticModelId`
- `indexImplementationId`

`privacyCheck` should be a structured safe result:

```ts
type RetrievalPrivacyCheck = {
  passed: boolean;
  leakedMemoryTextCount: number;
  leakedPromptTextCount: number;
  leakedRawMetadataCount: number;
};
```

`contextBudgetImpact` should not include snippets:

```ts
type ContextBudgetImpact = {
  deterministicMemoryContextCharacters: number;
  hybridMemoryContextCharacters: number;
  characterDelta: number;
  wouldDropDeterministicIds: string[];
  wouldAddSemanticIds: string[];
};
```

These are report shapes for future design, not implemented exported types.

## Metrics

### Recall On Expected Accepted Memories

Measures whether semantic or hybrid candidates include expected accepted
memories.

Recommended formula:

```text
recall = expectedInjectedIds found in candidate IDs / expectedInjectedIds count
```

Report separately for deterministic, semantic-only, and hybrid candidate sets.

### False Positive Count

Counts candidate IDs that are not expected and should not be injected. Semantic
retrieval should be penalized heavily for false positives because slow-variable
memory influence must remain conservative.

### Zero-Overlap Semantic Candidate Count

Counts semantic candidates that have no deterministic lexical overlap. This is
not automatically wrong in offline comparison, but it is high risk. A
zero-overlap semantic candidate must never reach production context injection
until a later design defines strict gates.

### Accepted-Only Violations

Counts pending, rejected, or archived memory IDs appearing in semantic or hybrid
candidates. Any accepted-only violation is a hard failure.

### Privacy Violations

Counts reports, logs, or traces that expose full memory text, raw prompt text,
model context snippets, raw metadata JSON, or embedding vectors. Any privacy
violation is a hard failure.

### Context Budget Impact

Compares the current deterministic memory context character count with the
hypothetical hybrid candidate set. Semantic retrieval must not create unbounded
context growth or displace deterministic high-confidence memories without a
future explicit policy.

### Deterministic Regression Count

Counts any case where adding semantic comparison changes the current
deterministic injected IDs. During prototype phases this must remain zero,
because semantic comparison must be report-only.

## Pass/Fail Rules

A semantic comparison prototype passes only if:

- deterministic injected IDs are unchanged
- `npm run rin:memory-eval` still passes
- `providerCallCount` remains `0` in default evaluation
- accepted-only violations equal `0`
- privacy violations equal `0`
- reports contain no full memory text
- no production retrieval or context injection behavior changes
- context budget impact is reported and bounded
- semantic-only false positives are visible in the report

A semantic comparison prototype fails if:

- any non-accepted memory appears in candidates
- any full memory text appears in report output
- any provider call occurs in default fixture evaluation
- semantic candidates are injected into model context
- deterministic fixture output changes
- a dependency or migration is required for the default comparison

## Fixture Expansion Plan

Future semantic comparison should add fixtures only after the report shape is
stable. Candidate fixture categories:

- paraphrase recall
- cross-language recall
- same-topic false positives
- personal preference near-miss
- project-name near-miss
- privacy-sensitive accepted memory
- stale embedding exclusion
- accepted-only semantic exclusion
- context budget pressure from semantic candidates
- deterministic baseline preservation

Fixture content must be synthetic and must not include real owner-private text.

## Semantic Retrieval Must Stay Out Of Production Until Stable

Semantic retrieval must not be merged into production retrieval or context
injection until comparison reports demonstrate stable value over multiple
fixture categories. The minimum future promotion gates are:

- deterministic baseline remains passing
- semantic comparison report is reproducible locally
- accepted-only and privacy hard failures remain zero
- false positives are below an explicit threshold
- zero-overlap candidates are reviewed and constrained
- stale embedding behavior is tested
- index rebuild/delete behavior is tested
- rollback to deterministic retrieval is trivial

Until those gates exist and pass, semantic retrieval remains design/prototype
work only.

## Relationship To Current Checks

Current required gates remain:

```sh
npm run rin:check
npm run rin:memory-eval
```

Future semantic comparison should be a separate command. It should not replace
`npm run rin:memory-eval`, and it should not become part of `npm run rin:check`
until it is deterministic, fixture-only, provider-free, and fast enough for the
default local check.
