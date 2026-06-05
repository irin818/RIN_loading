# RIN v2.0 Context Policy

Status: active v2.0 context reference.

## Production Context

Production conversation runtime builds bounded provider messages through the
runtime/context boundary. It includes:

- compact RIN system prompt
- compact local profile context when valid
- accepted-memory snippets selected through the memory layer
- bounded recent conversation history
- the current Owner message through the runtime turn path

The UI must not assemble provider prompts or call providers directly.

## Context V2 Report Policy

Context V2 is currently a report/evaluation path. It does not yet replace the
provider-facing production message assembly.

The Context V2 candidate order is:

1. system
2. RIN profile
3. Owner profile
4. current Owner message
5. short-term conversation window
6. Memory V2 traces
7. older references

The current Owner message is protected, preserved under budget pressure, and
must appear exactly once.

## Five-Hour Window

The short-term window is a rolling five-hour query over raw messages ending at
the latest Owner message. The latest Owner message is excluded from the
short-term segment if it is already represented as the current Owner message.

## Budget And Deduplication

Context V2 enforces a hard character budget for report/evaluation. Optional
segments are skipped when they exceed budget. Segments sharing the same source
are deduplicated so a raw message and a Memory V2 trace from that message do not
both appear as separate included evidence.

Reports include skipped counts, skip reasons, provenance, and whether the
latest Owner message was preserved.

## Privacy Boundary

Context V2 reports do not print full prompt text, full profile text, full
message text, or full memory text. They report IDs, counts, source references,
types, and safe status fields.

## Cutover Boundary

Production accepted-memory candidate sourcing has moved to Memory V2 migrated
legacy traces after migration, with legacy fallback while migration is
incomplete. Context V2 itself remains report/evaluation-only until a separate
explicit context cutover task changes provider-facing assembly.
