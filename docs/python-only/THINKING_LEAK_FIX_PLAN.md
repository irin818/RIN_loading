# Thinking Leak Fix Plan

Status: follow-up plan. This UI polish task does not change model, memory,
context, database, or sanitizer behavior.

## Current Observations

The Python Ollama adapter already sends:

```text
think: false
```

and has existing cleanup/rejection for:

- paired `<think>...</think>` blocks;
- trailing `</think>` output;
- empty content after thinking removal;
- remaining `<think>`, `</think>`, `internal analysis`, and `hidden reasoning`
  markers.

Owner feedback says reasoning/thinking can still leak in live replies, so the
existing guard is not sufficient for all Qwen3 outputs.

## Dedicated Follow-Up Scope

Handle this in a separate model/runtime task:

- verify Ollama receives `think=false` for qwen3:4b in live requests;
- collect safe, redacted examples of leaked patterns;
- broaden post-generation sanitizer tests for Qwen3-specific output;
- strip or reject additional `<think>...</think>` variants;
- reject Chinese internal-analysis phrasing and reasoning preambles;
- ensure thinking-only content is never stored as a RIN message;
- confirm UI renders only sanitized final assistant content;
- run live smoke prompts with `qwen3:4b` and external provider calls at `0`.

## Non-Goals For This UI Task

- no Memory V2 changes;
- no Context V2 changes;
- no database schema changes;
- no Ollama adapter rewrite;
- no broad model behavior changes.
