# RIN Local Launcher

Status: owner-facing local startup guide.

## Default Safe Launcher

Double-click `Start_RIN.command` from the repository root.

It will:

- check the Python virtual environment exists;
- check required Python packages are installed;
- check the production migration marker exists;
- check Ollama is reachable at `http://127.0.0.1:11434`;
- check `qwen3:4b` is available;
- start the Python FastAPI server in local model mode;
- serve `http://127.0.0.1:8765/`;
- open the browser once after the server is ready;
- keep the terminal window open for logs.

The default launcher does not require API keys and does not call external APIs.

## Local Ollama / Qwen3 Defaults

If the model is missing, run:

```sh
ollama pull qwen3:4b
```

The launcher sets only local Ollama environment variables for the process it
starts:

- `RIN_MODEL_ADAPTER=rin-ollama-local`
- `RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `RIN_OLLAMA_MODEL=qwen3:4b`
- `RIN_OLLAMA_TIMEOUT_MS=180000`
- `RIN_OLLAMA_NUM_PREDICT=1024`

These defaults give Qwen3 more room to produce final assistant content. The
Ollama adapter also sends `think: false` for local chat so Qwen3 returns final
assistant text instead of spending the response on `message.thinking`. You can
override the numeric settings in your shell before launching if needed. If Qwen3
still returns thinking tags or a reasoning preamble in `message.content`, the
adapter removes recognized thinking-tag content and rejects remaining
internal-analysis-style output instead of storing it as a RIN reply. Remaining
thinking leaks are tracked in `docs/python-only/THINKING_LEAK_FIX_PLAN.md`.

## Removed Compatibility Launchers

The only normal owner-facing root launcher is now `Start_RIN.command`.
`Start_RIN_Python.command` and `Start_RIN_Python_Local_Model.command` were
removed intentionally to reduce launcher confusion. Do not recreate replacement
root launchers for normal operation.

## Local Chat Smoke

Run this explicit local-only smoke command to test normal local chat without
starting the Console:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
RIN_OLLAMA_NUM_PREDICT=1024 \
RIN_OLLAMA_TIMEOUT_MS=180000 \
cd python && .venv/bin/rin-python-local-chat-smoke
```

Without `RIN_MODEL_ADAPTER=rin-ollama-local`, the command skips safely and does
not call a model.

## Python Checks

Run the active Python checks:

```sh
cd python
. .venv/bin/activate
python -m pytest
rin-python-production-check
```

Run the optional live local chat smoke only when local Ollama is selected:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
RIN_OLLAMA_NUM_PREDICT=1024 \
RIN_OLLAMA_TIMEOUT_MS=180000 \
rin-python-local-chat-smoke
```

The live smoke uses a temporary data directory, does not read the owner's real
`.rin-data`, does not call external APIs, and reports only safe status, length,
issue code, and call-count fields.

## Empty Content / MODEL_RESPONSE_INVALID

If Qwen3 returns `MODEL_RESPONSE_INVALID`, it may have produced no final
`message.content`. This can happen when the model spends its output budget on
reasoning/thinking. RIN does not store thinking-only output as a fake assistant
reply and does not print raw provider responses. The same error can also mean
the response still looked like internal analysis after thinking artifacts were
removed.

Try:

- rerun with `RIN_OLLAMA_NUM_PREDICT=1024` or higher;
- use a shorter prompt;
- ask Qwen3 for final answer only;
- try a non-reasoning local model if one is available.

## If macOS Blocks The Launcher

If double-clicking says the file cannot be opened, run this from the repository:

```sh
chmod +x Start_RIN.command
```

If macOS quarantine blocks the file after download or transfer, run:

```sh
xattr -d com.apple.quarantine Start_RIN.command
```

## If Python Dependencies Are Missing

The launcher will not install dependencies automatically. Run:

```sh
cd python
python3.12 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

Then double-click the launcher again.

## TypeScript Fallback

TypeScript fallback is rollback-only through the `typescript-final-fallback` Git
tag. Use it only when validating or performing rollback from the Python primary
path.

## Secrets Policy

Do not put API keys, tokens, passwords, or private paths in launcher files.
External providers remain optional diagnostics/fallback adapters and are not
required for local launch.
