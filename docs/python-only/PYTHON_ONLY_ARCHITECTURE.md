# Python-Only Architecture

Status: Package G final architecture summary.

## Active Runtime

The active runtime is Python under `python/src/rin`.

Primary surfaces:

- FastAPI server, Jinja2 templates, static CSS/JS, and HTML UI: `rin.server`
- Conversation runtime: `rin.conversation`
- SQLite/local data layout: `rin.database`, `rin.storage`
- Profiles and slow variables: `rin.profiles`
- Model adapter boundary: `rin.model`
- Safety and cutover diagnostics: `rin.diagnostics`
- Replaceable body status boundary: `rin.body`

## Launch

Active launcher:

- `Start_RIN.command`

The launcher starts the Python UI locally at `http://127.0.0.1:8765/`, defaults
to Ollama `qwen3:4b`, and keeps external APIs disabled. The old
`Start_RIN_Python.command` and `Start_RIN_Python_Local_Model.command` root
launchers, plus the `打开RIN项目.command` alias, were removed intentionally to
keep one normal launch path.

The UI has no TypeScript, React, Vite, Node, npm, or frontend build chain.
The RIN presence panel uses a local static asset from `public/live2d/` and the
Python body status boundary. Full Cubism runtime remains future work.

## Rollback

TypeScript rollback is Git-tag based:

```text
typescript-final-fallback
```

The active tree does not keep runnable TypeScript fallback scripts.

## Data Boundaries

Protected local data:

- `.rin-data/`
- `.rin-python-backups/`
- `.rin-python-cutover-state/`
- `.rin-python-preview-data/`

These are local runtime/state artifacts and must not be committed.
