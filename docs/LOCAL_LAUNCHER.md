# RIN Local Launcher

Status: owner-facing local startup guide.

## Default Safe Launcher

Double-click `Start_RIN_Python.command` from the repository root.

It will:

- check the Python virtual environment exists;
- check the production migration marker exists;
- start the Python FastAPI server and local web UI;
- serve `http://127.0.0.1:8765/`;
- keep the terminal window open for logs.

The default launcher does not set external provider environment variables, does
not require API keys, and does not call external APIs.

## Local Ollama / Qwen3 Launcher

Double-click `Start_RIN_Python_Local_Model.command` when you explicitly want to
use local Ollama with `qwen3:4b`.

It will first check that Ollama is reachable at `http://127.0.0.1:11434` and
that `qwen3:4b` is available. If the model is missing, run:

```sh
ollama pull qwen3:4b
```

This launcher sets only local Ollama environment variables for the process it
starts. It does not call external APIs.

The local model launcher defaults to:

- `RIN_OLLAMA_TIMEOUT_MS=180000`
- `RIN_OLLAMA_NUM_PREDICT=1024`
- `RIN_OLLAMA_TEMPERATURE=0.5`
- `RIN_OLLAMA_TOP_P=0.9`

These defaults give Qwen3 more room to produce final assistant content. The
Ollama adapter also sends `think: false` for local chat so Qwen3 returns final
assistant text instead of spending the response on `message.thinking`. You can
override the numeric settings in your shell before launching if needed. If Qwen3
still returns thinking tags or a reasoning preamble in `message.content`, the
adapter removes recognized thinking-tag content and rejects remaining
internal-analysis-style output instead of storing it as a RIN reply.

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

## Daily Chat Quality Checks

Run the default provider-free daily chat fixture gate:

```sh
npm run rin:daily-chat-eval
```

This command does not require Ollama, does not read real `.rin-data`, and does
not print full chat text. It checks common daily prompts for thinking leaks,
policy dumps, fake external access claims, empty output, and excessive length.

Run the optional live local daily chat smoke only when local Ollama is selected:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
RIN_OLLAMA_NUM_PREDICT=1024 \
RIN_OLLAMA_TIMEOUT_MS=180000 \
npm run rin:daily-chat-live-smoke
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
chmod +x Start_RIN_Python.command Start_RIN_Python_Local_Model.command scripts/typescript-fallback/*.command scripts/typescript-fallback/*.sh
```

If macOS quarantine blocks the file after download or transfer, run:

```sh
xattr -d com.apple.quarantine Start_RIN_Python.command Start_RIN_Python_Local_Model.command scripts/typescript-fallback/*.command
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

TypeScript fallback is rollback-only under `scripts/typescript-fallback/`.
Use it only when validating or performing rollback from the Python primary path.

## Secrets Policy

Do not put API keys, tokens, passwords, or private paths in launcher files.
External providers remain optional diagnostics/fallback adapters and are not
required for local launch.
