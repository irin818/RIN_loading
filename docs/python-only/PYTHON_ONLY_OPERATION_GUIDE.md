# Python-Only Operation Guide

Status: Python-only active operation after TypeScript Core deletion.

## Active Launchers

The only active root launchers are Python launchers:

```sh
./Start_RIN_Python.command
./Start_RIN_Python_Local_Model.command
```

Both start the Python FastAPI server and local web UI at:

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
- visible error rendering;
- read-only reload of persisted history;
- clear Python-primary runtime identity.

## Recommended Launcher

Use local Ollama/Qwen3 mode when available:

```sh
./Start_RIN_Python_Local_Model.command
```

Use provider-free mock mode for local UI/runtime testing:

```sh
./Start_RIN_Python.command
```

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
