# Python Production Launcher

Status: Package D launcher path.

## Launcher

Current owner-facing launcher:

```sh
./Start_RIN.command
```

It starts Python RIN with local Ollama `qwen3:4b` by default. The old
`Start_RIN_Python.command` and `Start_RIN_Python_Local_Model.command` names were
removed later to reduce launcher confusion.

TypeScript fallback is now rollback-only through:

```sh
git checkout typescript-final-fallback
```

## Safety Behavior

- The Python launcher refuses to start unless
  `.rin-data/config/python_cutover_marker.json` exists.
- Python server binds only to `127.0.0.1:8765`.
- The launcher checks local Ollama for `qwen3:4b`.
- Local model timeout defaults to 180 seconds.
- External APIs are not required or enabled.
- TypeScript Core and fallback launchers are no longer present in the active
  Python-only tree.
