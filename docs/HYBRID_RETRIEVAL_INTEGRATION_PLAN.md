# Hybrid Retrieval Integration Plan

Status: future plan. Mega-Milestone 10 does not integrate semantic retrieval
into production.

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
5. no semantic-only candidate reaches production context until later gates pass

Mega-Milestone 10 remains in report-only evaluation.

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
