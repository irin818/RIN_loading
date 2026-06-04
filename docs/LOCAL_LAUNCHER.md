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
