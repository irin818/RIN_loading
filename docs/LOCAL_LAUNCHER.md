# RIN Local Launcher

Status: owner-facing local startup guide.

## Default Safe Launcher

Double-click `Start_RIN.command` from the repository root.

It will:

- check Node.js and npm are available;
- check `node_modules/` exists;
- run `npm run rin:readiness`;
- start `npm run rin:console`;
- open `http://127.0.0.1:4173`;
- keep the terminal window open for logs.

The default launcher does not set external provider environment variables, does
not require API keys, and does not call external APIs.

## Local Ollama / Qwen3 Launcher

Double-click `Start_RIN_Local_Model.command` only when you explicitly want to use
local Ollama with `qwen3:4b`.

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
override the numeric settings in your shell before launching if needed.

## Local Chat Smoke

Run this explicit local-only smoke command to test normal local chat without
starting the Console:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
RIN_OLLAMA_NUM_PREDICT=1024 \
RIN_OLLAMA_TIMEOUT_MS=180000 \
npm run rin:local-chat-smoke
```

Without `RIN_MODEL_ADAPTER=rin-ollama-local`, the command skips safely and does
not call a model.

## Empty Content / MODEL_RESPONSE_INVALID

If Qwen3 returns `MODEL_RESPONSE_INVALID`, it may have produced no final
`message.content`. This can happen when the model spends its output budget on
reasoning/thinking. RIN does not store thinking-only output as a fake assistant
reply and does not print raw provider responses.

Try:

- rerun with `RIN_OLLAMA_NUM_PREDICT=1024` or higher;
- use a shorter prompt;
- ask Qwen3 for final answer only;
- try a non-reasoning local model if one is available.

## If macOS Blocks The Launcher

If double-clicking says the file cannot be opened, run this from the repository:

```sh
chmod +x Start_RIN.command Start_RIN_Local_Model.command scripts/start-rin.sh scripts/start-rin-local-model.sh
```

If macOS quarantine blocks the file after download or transfer, run:

```sh
xattr -d com.apple.quarantine Start_RIN.command Start_RIN_Local_Model.command
```

## If Dependencies Are Missing

The launcher will not install dependencies automatically. Run:

```sh
npm install
```

Then double-click the launcher again.

## Secrets Policy

Do not put API keys, tokens, passwords, or private paths in launcher files.
External providers remain optional diagnostics/fallback adapters and are not
required for local launch.
