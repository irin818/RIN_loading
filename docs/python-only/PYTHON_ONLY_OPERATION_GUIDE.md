# Python-Only Operation Guide

Status: Python-only active operation after TypeScript Core deletion.

## Active Launchers

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
- local RIN avatar/presence panel;
- visible error rendering;
- read-only reload of persisted history;
- clear Python-primary runtime identity.

## Recommended Launcher

Double-click:

```sh
./Start_RIN.command
```

Compatibility/developer launchers:

- `Start_RIN_Python_Local_Model.command` delegates to `Start_RIN.command`.
- `Start_RIN_Python.command` remains non-default provider-free mock mode for
  developer testing.

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
