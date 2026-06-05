# RIN v2.0 Operations Guide

Status: active v2.0 operations guide.

## Install

```sh
npm install
```

## Initialize Local Data

For real local use:

```sh
npm run rin:init
```

For tests or handoff checks, use a temporary data directory:

```sh
RIN_DATA_DIR=/tmp/rin-v2-check npm run rin:init
```

Do not commit `.rin-data/`.

## Default Verification

Run the v2 release gate:

```sh
RIN_DATA_DIR=/tmp/rin-v2-check npm run rin:v2-check
```

`rin:v2-check` runs the default aggregate check plus v2-specific reports and
evaluations. It does not call external providers and does not apply real
legacy-memory migration.

## Local Conversation

Default development uses the local mock adapter unless configuration selects a
real adapter.

Start the local Console:

```sh
npm run rin:console
```

The Console must not call model providers directly. Conversation requests go
through the runtime and configured model adapter.

## Optional Local Ollama/Qwen3

Use local Ollama only when explicitly selected:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
npm run rin:readiness
```

Optional live daily chat smoke:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
npm run rin:daily-chat-live-smoke
```

These commands are separate from default release checks.

## Profiles

Profiles are local manual slow variables:

- `.rin-data/config/rin_profile.json`
- `.rin-data/config/owner_profile.json`

Validate and report:

```sh
npm run rin:profile-validate
npm run rin:profile-report
```

Reports print status, counts, and issues; they do not dump full private profile
text.

## Memory V2

Safe reports and evaluations:

```sh
npm run rin:memory-v2-schema-report
npm run rin:short-term-memory-report
npm run rin:memory-v2-eval
npm run rin:memory-v2-shadow-report
npm run rin:memory-v2-migration-dry-run
npm run rin:memory-v2-migration-status
```

Apply legacy migration only when intentionally selected:

```sh
npm run rin:memory-v2-migration-apply
```

The apply command is additive and idempotent. It writes Memory V2 trace rows for
legacy accepted memories and preserves legacy records.

## Context V2

Report and evaluate the candidate context policy:

```sh
npm run rin:context-v2-report
npm run rin:context-v2-eval
```

Context V2 reports do not print full prompts, profile text, message text, or
memory text.

## Backup, Sync, Body, Reliability

These areas remain frozen for v2 core development. Existing commands may be used
for compatibility and local inspection, but Package 8 does not add new features
there.

- Backup/restore commands are explicit local operations.
- Sync commands remain report/dry-run only.
- Body/Live2D commands verify the current body boundary; real Cubism loading is
  not implemented.
- Reliability commands are report/smoke checks, not automatic repair.

## Secret And Data Rules

Never commit local data, generated outputs, or credentials:

- `.rin-data/`
- `node_modules/`
- `dist/`
- `.env` or `.env.*`
- SQLite databases
- logs
- API keys or tokens
