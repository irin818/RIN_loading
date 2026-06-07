# Memory Console Guide

Status: first useful read-only Memory Console.

The Memory tab is an observability surface. It does not change Memory V2,
database schema, retrieval behavior, or stored memory content.

## What It Shows

- Memory Algorithm: current short-term window policy, Memory V2 write policy,
  retrieval status, scoring summary, privacy policy, and retention formula
  status.
- AI Memory State: trace count, signal count, last-turn injected count, and last
  update status.
- Retrieval Status: whether Memory V2 retrieval is wired into prompt assembly.
- Memory Curve: retention formula and sample points. These show `n/a` until a
  real decay/stability parameter exists.
- Safe Memory Trace Index: trace ids, type, salience score, timestamps, signal
  keys, source message ids, raw-text-included status, content length, and short
  safe previews.
- Last Turn Memory Update: safe update counts from Runtime Trace.
- Gaps / Warnings: known inactive parts, especially retrieval not being wired.

## Privacy

The endpoint and UI are read-only and local-only. They do not expose full private
conversation text, full profile text, full memory text, raw prompts, raw model
output, or hidden reasoning by default.

## Memory Retrieval Not Wired

Memory V2 writes safe candidate traces after successful turns, but active prompt
assembly does not yet retrieve those traces. The console must show this gap
plainly instead of implying memory is already being injected into responses.

Short-term conversation context is separate from Memory V2. The active runtime
does inject bounded recent conversation content into the model request, while
long-term Memory V2 retrieval remains skipped until a future explicit retrieval
task wires it in.

Use Runtime Trace to verify the current turn:

```text
Runtime Trace -> Memory Retrieval -> skipped
```

Use the Memory tab to inspect whether traces are accumulating and whether the
last turn created a new safe trace.
