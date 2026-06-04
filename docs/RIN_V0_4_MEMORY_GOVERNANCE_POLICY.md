# RIN v0.4 Memory Governance Policy

Status: v0.4 design lock.

Memory governance is suggestion-only. RIN may report stale candidates, possible
conflicts, duplicate merge candidates, and archive review candidates, but it must
not delete, archive, merge, downgrade, overwrite, or otherwise mutate memory
without an explicit future owner-reviewed action path.

## Allowed Reports

- `npm run rin:memory-health-report`
- `npm run rin:memory-conflict-report`
- `npm run rin:memory-governance-smoke`

Reports may include memory IDs, statuses, memory types, counts, and safe reason
codes.

## Forbidden Behavior

- No automatic memory deletion.
- No automatic archive.
- No automatic merge.
- No automatic downgrade of owner-reviewed memories.
- No hidden memory mutation.
- No broad report output containing full memory text, raw prompts, model context
  snippets, vectors, secrets, or local paths.
- No provider calls.

## Status Handling

- `accepted`: may be suggested for stale/low-confidence review, duplicate merge
  review, or possible conflict review.
- `proposal`: may be suggested for long-pending review or possible conflict
  review.
- `rejected`: may be suggested for retention review only.
- `archived`: may be included in retention review only.

All v0.4 reports must preserve `mutatedMemoryCount: 0` and
`providerCallCount: 0`.
