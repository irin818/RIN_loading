# Python-Only Operation Guide

Status: Python-only active operation after TypeScript Core deletion.

## Active Launcher

The owner-facing default launcher is:

```sh
./Start_RIN.command
```

It starts Python FastAPI in local Ollama/Qwen3 mode and opens the local web UI at:

```text
http://127.0.0.1:8765/
```

## Python Console Coverage

The Python web UI covers the active owner-facing Console path:

- chat input;
- RIN response display;
- conversation history;
- readiness and local status;
- selected adapter and local-model status;
- profile summary;
- memory/context trace summary;
- useful read-only Memory Console with algorithm, state, safe trace index,
  retrieval gap, curve status, and health;
- runtime dataflow trace page for the latest real backend chat turn;
- local RIN avatar/presence panel;
- visible error rendering;
- read-only reload of persisted history;
- clear Python-primary runtime identity.

Runtime Trace is safe by default: it shows ids, counts, timestamps, lengths,
short previews, hashes, and stage status, but not full prompts, profile text,
memory text, hidden reasoning, or raw model output.

The console preserves the active tab in the browser. Chat submissions use a JSON
Chat/Test endpoint and update the message stream in place instead of replacing
the whole document, so the page avoids the old `document.write` jump.

Response speed depends on local model cold start, Ollama/qwen3:4b inference
speed, request size, `num_predict`, and whether the model attempts hidden
reasoning despite `think=false`. Runtime Trace can be used to compare request
characters, model duration, raw/final answer length, and sanitizer removal.

Recent conversation context is active: the runtime sends bounded recent dialogue
content to the local model while keeping the latest owner message last and
untruncated. Long-term Memory V2 retrieval is still not wired into prompt
assembly and is shown as skipped in Runtime Trace and Memory.

## Recommended Launcher

Double-click:

```sh
./Start_RIN.command
```

`Start_RIN.command` is the only normal owner-facing root launcher. The old
`Start_RIN_Python_Local_Model.command` and `Start_RIN_Python.command` names were
removed intentionally to reduce confusion. `打开RIN项目.command` was also removed
as an extra root alias; external APIs remain disabled.

## Production Safety

The Python production server refuses to start unless the migration marker exists:

```text
.rin-data/config/python_cutover_marker.json
```

Backups under `.rin-python-backups/` must not be deleted.

## TypeScript Fallback

TypeScript fallback is preserved through Git history and the final fallback tag:

```text
typescript-final-fallback
```

The active tree no longer contains runnable TypeScript fallback scripts.
