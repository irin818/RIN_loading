# Memory Retrieval Evaluation Plan

## Purpose

This document defines how semantic retrieval prototypes should be compared
against RIN's current deterministic accepted-memory retrieval. Mega-Milestone 9
implements the first fixture-only comparison harness. The harness does not
implement real semantic retrieval, add embeddings, add dependencies, change
production retrieval behavior, or alter context injection.

Ultra-Milestone 10 extends semantic comparison with a deterministic
fixture/mock embedding provider, in-memory vector index, prototype candidate
generation, and semantic readiness reporting. These additions remain
fixture-only and report-only.

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

## Current Fixture-Only Semantic Comparison Harness

`npm run rin:semantic-eval` runs `src/memory/semanticEvaluation.ts` over
synthetic in-memory fixtures from `src/memory/semanticEvaluationFixtures.ts`.
It compares the current deterministic injected IDs with explicit fixture-only
semantic candidate IDs and report-only hybrid candidate IDs.

The current successful output is expected to include:

- `Total: 11`
- `Passed: 11`
- `Failed: 0`
- `providerCallCount: 0`
- fixture prototype provider identity
- prototype topK and candidate cap values
- deterministic, semantic, prototype, and hybrid candidate counts
- false-positive and false-negative counts
- accepted-only violation count
- zero-overlap semantic candidate count
- category-level pass/fail lines

The built-in semantic comparison fixtures cover:

- paraphrase recovery that deterministic retrieval misses
- an expected semantic false positive
- hybrid report composition
- non-accepted semantic candidate flagging and exclusion
- privacy/no full memory text leak
- zero-overlap semantic candidates as report-only candidates
- deterministic baseline preservation
- fixture/mock embedding prototype candidate generation
- vector index deterministic ordering
- topK and candidate cap behavior
- query with no semantic candidates
- old/no-semantic-annotation neutrality

The harness intentionally includes expected negative signals, such as one
false-positive candidate and one non-accepted candidate violation, so the report
shape proves those risks are detected. Those expected negative signals do not
mean semantic retrieval is production-safe; a future promotion gate must require
zero unexpected accepted-only and privacy violations before integration.

Super-Milestone 12-14 adds separate report-only accepted-memory and hybrid
commands. They do not replace this fixture-only harness:

- `npm run rin:semantic-index-report` is disabled by default and requires
  accepted-memory index opt-in before listing real accepted memories.
- `npm run rin:semantic-live-index-report` is separate, live-local only, and
  requires both accepted-memory index opt-in and live provider config.
- `npm run rin:hybrid-retrieval-report` is disabled by default and reports
  deterministic, semantic-only, deterministic-only, overlap, false-positive, and
  false-negative candidate IDs without context injection.
- `npm run rin:semantic-trace-list` and `npm run rin:semantic-trace-read` inspect
  sanitized trace audit records without provider calls.
- Default runs of these commands must not call providers, list memories, read
  real `.rin-data`, or print full memory text.

Package 2 adds opt-in semantic context candidate expansion. The default path
remains off and must preserve deterministic injected IDs. The opt-in path must
prove accepted-only filtering, deterministic-first merge order, duplicate
deduping, candidate count caps, semantic character caps, whole-context budget
enforcement, latest-owner preservation, safe trace fields, and provider-free
default checks.

## Comparison Fields

Semantic comparison results include safe IDs and aggregate fields only:

- `caseId`
- `categories`
- `query`
- `deterministicInjectedIds`
- `semanticCandidateIds`
- `explicitSemanticCandidateIds`
- `prototypeSemanticCandidateIds`
- `safePrototypeSemanticCandidateIds`
- `safeSemanticCandidateIds`
- `hybridCandidateIds`
- `semanticCandidateSourceBreakdown`
- `expectedInjectedIds`
- `falsePositiveIds`
- `falseNegativeIds`
- `privacyCheck`
- `acceptedOnlyViolationIds`
- `acceptedOnlyPassed`
- `providerCallCount`
- `zeroOverlapSemanticCandidateIds`
- `contextBudgetImpact`
- `semanticRuntimeId`
- `semanticModelId`
- `indexImplementationId`
- `prototypeSemanticProvider`
- `prototypeTopK`
- `prototypeCandidateCap`

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

The implemented exported types live in `src/memory/semanticEvaluation.ts`.

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
candidates. In production promotion gates, any unexpected accepted-only
violation is a hard failure. The fixture-only harness may include an expected
negative case so that flagging and hybrid exclusion are tested.

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
- unexpected accepted-only violations equal `0`
- privacy violations equal `0`
- reports contain no full memory text
- no production retrieval or context injection behavior changes
- context budget impact is reported and bounded
- semantic-only false positives are visible in the report
- report-only accepted-memory and hybrid commands remain disabled by default
- explicit report command outputs are ID/count/status-only
- semantic trace persistence stores only sanitized IDs/counts/status fields
- opt-in semantic context expansion is disabled by default and preserves the
  deterministic baseline, system prompt, latest owner message, accepted-only
  filtering, caps, and budgets
- runtime raw/audit events distinguish deterministic and semantic injected IDs
  without full memory text

A semantic comparison prototype fails if:

- any unexpected non-accepted memory appears in candidates
- any non-accepted memory appears in report-only hybrid candidate IDs
- any full memory text appears in report output
- any provider call occurs in default fixture evaluation
- semantic candidates are injected into model context
- semantic context expansion is enabled without explicit config
- deterministic fixture output changes
- a dependency or migration is required for the default comparison

## Fixture Expansion Plan

The initial fixture-only comparison suite is in place. Future semantic
comparison can add fixtures after the report shape remains stable. Candidate
fixture categories:

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

Mega-Milestone 9 adds that separate command:

```sh
npm run rin:semantic-eval
```

For now it should be reported explicitly for semantic retrieval comparison work,
beside `npm run rin:check` and `npm run rin:memory-eval`.

Ultra-Milestone 10 adds a separate readiness command:

```sh
npm run rin:semantic-readiness
```

It should pass without Ollama or provider calls. It reports that production
semantic retrieval remains disabled, local embedding providers are disabled by
default, no vector DB is configured, and no real `.rin-data` indexing is active.
