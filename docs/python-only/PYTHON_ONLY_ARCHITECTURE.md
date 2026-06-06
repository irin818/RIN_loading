# Python-Only Architecture

Status: Package G final architecture summary.

## Active Runtime

The active runtime is Python under `python/src/rin`.

Primary surfaces:

- FastAPI server and HTML UI: `rin.server`
- Conversation runtime: `rin.conversation`
- SQLite/local data layout: `rin.database`, `rin.storage`
- Profiles and slow variables: `rin.profiles`
- Model adapter boundary: `rin.model`
- Safety and cutover diagnostics: `rin.diagnostics`
- Replaceable body status boundary: `rin.body`

## Launch

Active launchers:

- `Start_RIN_Python.command`
- `Start_RIN_Python_Local_Model.command`
- `打开RIN项目.command`

The UI binds locally at `http://127.0.0.1:8765/`.

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
