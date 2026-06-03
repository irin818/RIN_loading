# Hybrid Retrieval Integration Plan

Status: report-only hybrid candidate expansion implemented in Super-Milestone
12-14; Package 2 adds sanitized trace persistence and disabled-by-default
semantic context candidate expansion.

## Baseline Rule

Deterministic accepted-memory retrieval remains the production baseline. Current
production context injection must continue to use the existing deterministic
path until semantic retrieval passes explicit opt-in and evaluation gates.

## Candidate Expansion First

Future semantic retrieval should start as candidate expansion only:

1. deterministic retrieval produces the known-safe baseline
2. semantic retrieval proposes candidate IDs
3. accepted-only filtering removes unsafe IDs
4. report compares deterministic, semantic, and hybrid candidate IDs
5. no semantic-only candidate reaches context unless explicit Package 2
   candidate-expansion config is enabled and all caps/budgets apply

Mega-Milestone 10 remains in fixture-only evaluation. Super-Milestone 12-14 adds
an explicit report command:

```sh
npm run rin:hybrid-retrieval-report -- --allow-hybrid-retrieval-report --query "local query"
```

Equivalent environment opt-in is:

```sh
RIN_HYBRID_RETRIEVAL_REPORT=report-only \
RIN_HYBRID_RETRIEVAL_QUERY="local query" \
npm run rin:hybrid-retrieval-report
```

Without opt-in, the command reports disabled, does not list memories, does not
call providers, and does not read real `.rin-data`.

## Accepted-Only Filtering

Accepted-only filtering must happen before indexing, semantic scoring, and
hybrid candidate expansion. Non-accepted memories may appear only in synthetic
fixtures that prove detection and exclusion.

## Context Budget Interaction

Future hybrid retrieval must not create unbounded context growth. It must report:

- deterministic memory context characters
- hypothetical hybrid memory context characters
- character delta
- deterministic IDs that would be dropped
- semantic IDs that would be added

Semantic candidates must not displace high-confidence deterministic baseline
memories without an explicit policy.

## Ranking Merge Policy

A future merge policy should preserve deterministic priority:

- deterministic injected IDs remain first by default
- semantic candidates are appended or reranked only behind explicit config
- false-positive prone categories require stricter thresholds
- zero-overlap semantic candidates require special review
- stable id tie-breaks are required

## False-Positive Control

Semantic false positives are high risk because accepted memories are slow
variables. Before production integration, eval must define thresholds for:

- false-positive count
- false-negative count
- zero-overlap candidate count
- accepted-only violation count
- privacy violation count

Unexpected accepted-only and privacy violations must remain hard failures.

## Trace Fields

Future trace fields should remain safe and ID-based:

- deterministic candidate IDs
- semantic candidate IDs
- hybrid candidate IDs
- source breakdown
- score components
- provider id
- model id
- index implementation id
- stale/excluded IDs

Trace must not expose full memory text, raw prompt text, model context snippets,
embedding vectors, or raw metadata JSON.

## Rollout Stages

1. Fixture-only semantic eval.
2. Temp-data local embedding prototype.
3. Offline accepted-memory index behind explicit local opt-in.
4. Report-only live local index.
5. Candidate expansion behind config.
6. Production opt-in only after eval, privacy, readiness, rollback, and owner
   control gates pass.

Super-Milestone 12-14 implements stage 5 only as a report command. Package 2
adds an explicit candidate-expansion mode for context assembly, but the default
path still does not pass hybrid candidate IDs to `buildModelContext`,
conversation runtime, server APIs, Console behavior, or persisted production
traces.

Package 2 persists safe semantic/hybrid report traces and adds opt-in semantic
context candidate expansion. This does not replace deterministic retrieval. The
first persistence step uses existing audit storage rather than a separate table
because semantic report traces are derived audit records, not canonical memory or
index state.

Persisted semantic/hybrid traces may include only safe fields:

- report mode, status, and opt-in state
- deterministic, semantic, hybrid, semantic-only, deterministic-only, and overlap
  candidate IDs
- accepted-only violation IDs and safe error codes
- provider mode/kind/id, candidate caps, counts, and provider-call count
- `productionIntegrationEnabled`, `contextInjectionEnabled`,
  `fullTextIncluded`, and `vectorIncluded` safety flags

Persisted semantic/hybrid traces must not include full memory text, raw owner
prompts, model context snippets, raw metadata JSON, embedding vectors, secrets,
environment dumps, or local paths.

Opt-in semantic context expansion policy:

- default is off
- deterministic retrieval remains first and remains the baseline
- semantic candidates may add only accepted memories not already selected
- semantic candidates are deduped, capped, and counted against the memory context
  character budget and whole context budget
- generated system prompt and latest owner message remain preserved
- semantic candidates are traceable as semantic/context-expansion source and can
  be disabled by removing local config
- default checks must remain provider-free

## Rollback Plan

Rollback must leave deterministic retrieval untouched:

- disable semantic config
- ignore semantic candidate expansion
- delete derived index files if present
- keep canonical memory data unchanged
- run `npm run rin:check`
- run `npm run rin:memory-eval`

## Production Blockers

Production hybrid retrieval remains blocked until:

- local embedding provider exists and is disabled by default
- index lifecycle is safe
- stale/delete/archive behavior is tested
- owner opt-in exists
- owner disable path exists
- readiness report passes
- semantic eval passes
- deterministic memory eval passes
