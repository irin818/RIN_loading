# ADR-0003: Conversation Turn Persistence Boundary

## Status

Accepted for RIN v2 Package 2.

## Context

The previous conversation runtime kept owner message persistence, context
assembly, model generation, RIN reply persistence, audit events, state updates,
and slow-variable snapshots inside one long database transaction. If model
generation failed, the whole turn rolled back, so the owner message disappeared
and only a failure event remained.

RIN v2 prioritizes safe conversation continuity. Owner messages are raw local
history and must not be lost merely because a model adapter fails. At the same
time, RIN replies must never be returned or displayed before they are stored.

## Decision

Conversation turns use a persistent `conversation_turns` record.

Turn processing is ordered as follows:

1. In a short transaction, create or load the conversation, persist the owner
   message, create the `conversation_turns` row, record `conversation.turn_started`,
   and commit.
2. Build model context from committed local state.
3. Call the model adapter outside any database transaction.
4. In a second short transaction, record the model response metadata, append the
   RIN message, persist memory-context trace metadata, update local state, record
   audit events, mark the turn completed, and commit.
5. On model or completion failure, mark the turn failed and record safe
   `conversation.turn_failed` metadata without writing a fake RIN reply.

`turnId` is an idempotency key:

- Reusing a failed turn id with the same owner content retries the same owner
  message and increments the attempt count.
- Reusing a completed turn id returns the already persisted RIN reply without
  calling the model adapter or appending a duplicate reply.
- Reusing a turn id with different owner content is rejected.

## Non-Goals

- No streaming response work.
- No UI/server feature expansion beyond existing endpoint compatibility.
- No external provider behavior changes.
- No deletion or rewrite of raw conversations.
- No fake RIN replies on failure.

## Consequences

- Model failures preserve owner messages and failed turn metadata.
- Runtime no longer holds a long database transaction while waiting for model
  generation.
- Retry behavior is explicit and auditable.
- The database schema advances with an additive, backward-compatible
  `conversation_turns` table.
- `rin:conversation-runtime-report` provides safe count and timing summaries
  without printing message text.
