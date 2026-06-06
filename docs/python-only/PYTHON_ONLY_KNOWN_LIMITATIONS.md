# Python-Only Known Limitations

Status: Package G final limitations.

## Known Limitations

- The Python UI is intentionally simple HTML served by FastAPI, not a rich React
  client.
- Active Live2D rendering is retired from current production; retained assets and
  development materials are future work only.
- Repository structure keeps `python/` as the active package root for now.
- Rollback to TypeScript requires checking out `typescript-final-fallback`; the
  active tree does not include runnable TypeScript fallback scripts.
- External API providers remain optional and are not part of the Python-only
  default path.
- The local model smoke depends on a running Ollama server with `qwen3:4b`.

## Not Limitations

- Python production can read real `.rin-data`.
- Python production writes are protected by the cutover marker.
- Python Console supports chat, history, readiness/status, profile summary,
  memory/context trace summary, local-model status, and visible errors.
- The final residue scan has no active tracked TypeScript/Node artifacts.
