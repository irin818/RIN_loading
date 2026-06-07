# Thinking Leak Fix Plan

Status: implemented first stabilization pass.

## Current Observations

The Python Ollama adapter already sends:

```text
think: false
```

and now has cleanup/rejection for:

- paired `<think>...</think>` blocks;
- trailing `</think>` output;
- empty content after thinking removal;
- remaining `<think>`, `</think>`, `internal analysis`, and `hidden reasoning`
  markers;
- Chinese internal-analysis prefaces such as `首先，用户问...`, `用户问...`,
  `我需要分析...`, `我们需要...`, `根据系统...`, `响应策略...`,
  `检查是否...`, `最终响应思路...`, and `完整响应草稿...`;
- English internal-analysis prefaces such as `the user asks...` and
  `I need to analyze...`, including Qwen3-style `Okay, the user is asking...`
  / `Let me check...` drafts;
- explicit final answer extraction from markers such as `最终答案：`,
  `最终回答：`, `直接回答：`, and `Final answer:`.

Owner feedback says reasoning/thinking can still leak in live replies, so the
existing guard is not sufficient for all Qwen3 outputs.

The Runtime Trace v2 page now makes this observable through safe metadata such
as `thinkingTagDetected`, `thinkingLikePrefixDetected`, `thinkingTagRemoved`,
`thinkingLikePrefixRemoved`, `rawLength`, `finalLength`,
`removedCharacterCount`, and stored-sanitized-only status. The UI also shows a
raw-to-final before/after length bar. It does not expose full raw model output or
hidden reasoning by default.

## Implemented Guard Strategy

The current first-pass sanitizer follows this order:

1. Remove paired `<think>...</think>` blocks.
2. If a closing `</think>` remains, keep only content after the final marker.
3. Extract a clear final-answer section when present.
4. Reject thinking-like prefaces when no safe final answer can be extracted.
5. Reject remaining unsafe thinking markers.

Rejected output is returned as `MODEL_RESPONSE_INVALID`; it is not stored as a
RIN reply and does not create a Memory V2 trace.

Runtime Trace records safe metadata for verification: raw/final lengths,
removed character count, thinking tag detection/removal, thinking-like prefix
removal, final-answer extraction, rejection reason, and stored-sanitized-only
status. It does not expose full raw model output.

The Ollama adapter now preserves safe raw provider metadata before sanitization
while returning only sanitized final content to the conversation runtime. Runtime
Trace separates provider metadata, adapter-sanitized content, runtime sanitizer
checks, and stored final answer.

## Non-Goals For This UI Task

- no database schema changes;
- no broad model behavior changes.
