# Python Production Launcher

Status: Package D launcher path.

## Launchers

Recommended local-model launcher:

```sh
./Start_RIN_Python_Local_Model.command
```

Provider-free/mock launcher:

```sh
./Start_RIN_Python.command
```

TypeScript fallback launchers remain available:

```sh
./Start_RIN.command
./Start_RIN_Local_Model.command
```

## Safety Behavior

- Python launchers refuse to start unless
  `.rin-data/config/python_cutover_marker.json` exists.
- Python server binds only to `127.0.0.1:8765`.
- Local model launcher checks local Ollama for `qwen3:4b`.
- Local model timeout defaults to 180 seconds.
- External APIs are not required or enabled.
- TypeScript Core and launchers are not removed.
