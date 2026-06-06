# Python Persistent Sandbox

Status: Package A cutover-acceleration sandbox.

## Purpose

The persistent Python sandbox gives RIN a restartable Python-only data directory
for multi-session testing before real production `.rin-data` migration.

This is not production data.

## Data Path

Sandbox data lives at:

```text
/Users/irin/Documents/RIN_loading/.rin-python-preview-data
```

The path is ignored by Git. It must not be committed, copied into migration
docs, or treated as owner production state.

## Commands

Initialize or repair the sandbox layout:

```sh
cd python
.venv/bin/rin-python-sandbox-init
```

Run a provider-free sandbox smoke:

```sh
cd python
.venv/bin/rin-python-sandbox-smoke
```

Preview what a reset would remove:

```sh
cd python
.venv/bin/rin-python-sandbox-reset-dry-run
```

There is intentionally no destructive reset apply command.

## Launcher

Manual macOS launcher:

```sh
scripts/python-preview/Start_RIN_Python_Sandbox.command
```

The launcher binds the Python server to `127.0.0.1`, uses the persistent
sandbox path, and prints that TypeScript fallback launchers remain available.

To use local Ollama explicitly:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_TIMEOUT_MS=180000 \
scripts/python-preview/Start_RIN_Python_Sandbox.command
```

## Safety Rules

- Production `.rin-data` remains forbidden.
- Sandbox writes are allowed only at `.rin-python-preview-data`.
- Default smoke uses the mock adapter and calls no providers.
- External APIs are not required or called.
- Reset is dry-run only.
