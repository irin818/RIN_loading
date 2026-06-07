# Architecture

## Current Project Type

`RIN-loading` is now a Python-first local runtime for the RIN personal agent
system. Active runtime code lives under `python/src/rin`, with tests under
`python/tests`.

The project remains local-first, single-owner, and local-model-first. External
APIs are not required for active operation.

## Active Runtime

Active launcher:

- `Start_RIN.command`

It runs the Python FastAPI application on `127.0.0.1:8765`, defaults to local
Ollama `qwen3:4b`, disables external API use, and serves the local Python web
UI. The old `Start_RIN_Python.command`,
`Start_RIN_Python_Local_Model.command`, and `打开RIN项目.command` launchers were
removed intentionally to leave one owner-facing root launcher.

The active UI is rendered with Jinja2 templates plus static CSS and minimal
vanilla JavaScript from `python/src/rin/server/`. There is no frontend build
chain. The console is a character-centered black-green glass HUD with a central
static RIN presence, translucent left/right panels, read-only live status
metrics, and lightweight CSS/JS visualizations. It uses local assets under
`public/live2d/` and does not claim full Cubism runtime support.

## Runtime Boundaries

- `rin.server`: FastAPI API, Jinja2 templates, static CSS/JS, and local web UI.
- `rin.conversation`: conversation runtime and model adapter boundary.
- `rin.database`: SQLite schema inspection and writes.
- `rin.storage`: local data layout and manifest handling.
- `rin.profiles`: local profile validation and summaries.
- `rin.model`: provider-neutral model adapters, including local Ollama.
- `rin.diagnostics`: safety, readiness, cutover, and production checks.
- `rin.body`: minimal replaceable body status boundary.

## Data Safety

Production data remains local under `.rin-data/`. Python production writes are
allowed only after the cutover marker exists:

```text
.rin-data/config/python_cutover_marker.json
```

Backups under `.rin-python-backups/` must be preserved.

## TypeScript Rollback

The active tree no longer contains TypeScript Core, React/Vite UI, Node
configuration, or runnable TypeScript fallback scripts.

Rollback is preserved through Git:

```text
typescript-final-fallback
```

Use:

```sh
git checkout typescript-final-fallback
```

## Live2D

Active Python production does not depend on Live2D rendering. Previous
TypeScript body/Live2D runtime surfaces were retired for current production.
Future Live2D work should be reintroduced as explicit Python-compatible work
with new tests and docs.
