# RIN

## 1. Purpose

This README is the owner/developer usage guide for the current RIN repository.

It should answer:

- what the project currently is;
- how to install it;
- how to run it;
- what the current runtime can do;
- where the main code lives.

It should not define agent rules, long-term project authority, Git workflow, or detailed architecture policy.

Use:

- AGENTS.md for AI agent execution rules;
- PROJECT_CHARTER.md for long-term goals and principles;
- DEVELOPMENT_PROTOCOL.md for development workflow;
- ARCHITECTURE.md for runtime structure.

---

## 2. What RIN Is

RIN is a local-first, single-owner personal AI runtime.

The current repository is the local runtime for RIN, with a Python backend/core and a TypeScript/React/Vite Web UI.

RIN is not a generic chatbot, SaaS product, Live2D toy, or simple API wrapper.

---

## 3. Current Status

Current active stack:

- Python backend/core: python/src/rin/
- Tests: python/tests/
- FastAPI local server with API routes
- Jinja2 templates for server-rendered pages
- TypeScript/React/Vite frontend: frontend/
- Glitch Core Multi-Window Console (Web UI)
- SQLite and local-file persistence
- Provider-neutral model adapter layer
- Local-model-first runtime strategy
- Launcher: Start_RIN.command (starts both backend and frontend)

---

## 4. Current Capabilities

The current runtime focuses on:

- local web console;
- manual Chat/Test interface;
- conversation runtime;
- model adapter boundary;
- local conversation persistence;
- memory proposal/review foundations;
- profile and identity file handling;
- runtime trace and diagnostics;
- developer checks;
- minimal body/Live2D boundary placeholder.

Inactive and forbidden-by-default features are listed in AGENTS.md.

---

## 5. Run

### One-Click Launcher

From the repository root:

```sh
./Start_RIN.command
```

This starts both backend and frontend automatically.

### Manual Start

Backend:

```sh
cd python
.venv/bin/python -m rin.cli.production_server
```

Frontend dev server:

```sh
cd frontend
npm install
npm run dev
```

### URLs

Backend API:

```text
http://127.0.0.1:8765
```

Frontend dev (Vite):

```text
http://127.0.0.1:5173
```

Glitch Core production path (when frontend/dist exists):

```text
http://127.0.0.1:8765/glitch-core
```

Before running, make sure Ollama is running and `qwen3:4b` is available locally.

The launcher expects the Python environment and local model runtime to be prepared.

---

## 6. Development Setup

Create and install the Python environment:

```sh
cd python
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
```

If python3.12 is not available, use another compatible Python 3.12+ executable.

---

## 7. Checks

Run from python/ after activating the virtual environment:

```sh
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy src
rin-python-candidate-check
rin-python-production-check
```

Optional local-model checks:

```sh
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke
```

---

## 8. Main Directories

| Path | Purpose |
|---|---|
| python/src/rin/ | Active Python runtime (backend/core) |
| python/tests/ | Active Python tests |
| python/pyproject.toml | Python package and tool configuration |
| frontend/ | TypeScript/React/Vite Web UI (Glitch Core Console) |
| public/ | Public static assets when used |
| live2d-development/ | Live2D authoring workspace, not core runtime |
| .rin-data/ | Local runtime data, not committed |

---

## 9. Local Data

Local runtime data may exist under:

```text
.rin-data/
```

Do not commit local data, databases, logs, exports, backups, or secrets.

---

## 10. Governance Files

| File | Role |
|---|---|
| AGENTS.md | First-read file for AI development agents |
| PROJECT_CHARTER.md | Long-term project principles |
| DEVELOPMENT_PROTOCOL.md | Practical development workflow |
| ARCHITECTURE.md | Current runtime architecture |
| README.md | Human usage guide |

AI agents should not use this README as their default startup context. They should read AGENTS.md first.

---

## 11. Development Principle

Develop RIN in small, testable, reviewable steps.

Do not damage long-term architecture for short-term convenience.

Slow variables control fast variables.