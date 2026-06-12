# ARCHITECTURE.md

## 1. Purpose

This file describes RIN's current implementation architecture.

It should answer:

- what the active runtime is;
- where core modules live;
- how data flows through the system;
- which module boundaries must be preserved.

It should not define project identity, long-term goals, Git workflow, task protocol, or final report format.

Use:

- AGENTS.md for agent execution rules;
- PROJECT_CHARTER.md for long-term principles;
- DEVELOPMENT_PROTOCOL.md for development procedures;
- README.md for owner-facing usage instructions.

---

## 2. Current Runtime

RIN uses a Python backend/core with a TypeScript/React/Vite frontend.

Active runtime stack:

- Python backend/core: python/src/rin/
- Python tests: python/tests/
- Backend server: FastAPI (API routes)
- Backend templates: Jinja2 (server-rendered pages)
- Frontend: TypeScript/React/Vite (Glitch Core Multi-Window Console)
- Frontend source: frontend/src/
- Persistence: local SQLite and local files
- Model access: provider-neutral adapter layer
- Launcher: Start_RIN.command

Python is the protected backend/core layer. The React/Vite frontend
is a first-class project area, not an experiment.

---

## 3. High-Level Data Flow

Current runtime flow:

```text
React Frontend (Glitch Core Console)
  -> FastAPI routes (explicit API contracts)
  -> conversation runtime
  -> context assembly
  -> model adapter
  -> response validation
  -> persistence
  -> diagnostics / trace

Server-rendered pages (Jinja2)
  -> FastAPI server
  -> (same backend pipeline)
```

Key rules:

- The UI (React or server-rendered) must not directly call model providers or directly write long-term memory.
- The React frontend must communicate through explicit backend API routes, not internal Python modules.
- API responses must be safe for display.

---

## 4. Module Boundaries

| Path | Responsibility |
|---|---|
| frontend/src/ | React/Vite Web UI, Glitch Core Console, API client |
| python/src/rin/server/ | FastAPI routes, server-rendered pages, templates, static files |
| python/src/rin/conversation/ | Chat-turn orchestration and conversation runtime |
| python/src/rin/model/ | Provider-neutral model interfaces and adapters |
| python/src/rin/memory/ | Memory proposal, review, retrieval, and memory context |
| python/src/rin/context/ | Context assembly, context budgeting, and context reports |
| python/src/rin/database/ | SQLite schema and persistence |
| python/src/rin/storage/ | Local data layout and file handling |
| python/src/rin/profiles/ | Owner model and AI identity model handling |
| python/src/rin/policy/ | Local policy checks, if present |
| python/src/rin/diagnostics/ | Readiness checks, reports, runtime diagnostics |
| python/src/rin/body/ | Minimal body / Live2D boundary |
| python/tests/ | Active test suite |

Do not mix these responsibilities without explicit architecture work.

---

## 5. Server and UI Layer

RIN has two UI surfaces:

1. React/Vite frontend (Glitch Core Console) — the primary Web UI
2. Server-rendered pages (Jinja2) — legacy/support UI

The React frontend is a first-class project area. It must communicate
through explicit backend API routes.

The UI layer (both surfaces) may:

- present local runtime state;
- expose safe runtime status;
- submit chat/test requests;
- display diagnostics;
- call internal server routes (server-rendered) or API routes (React frontend).

The UI layer must not:

- call model providers directly;
- write long-term memory directly;
- own identity, policy, or persistence logic;
- expose secrets or private raw data by default;
- import or depend on internal Python modules (React frontend).

---

## 6. Conversation Runtime

The conversation runtime coordinates one chat turn.

It may handle:

- input normalization;
- conversation selection;
- context assembly;
- model adapter invocation;
- response validation;
- error classification;
- persistence;
- safe trace metadata.

It must not hard-code a specific model provider.

---

## 7. Model Layer

The model layer isolates provider-specific behavior.

Chat reasoning is external API only. Local models are not part of the active chat dialogue path. They are reserved for future non-chat features only (OCR, vision, speech, classification, local preprocessing, offline utilities).

Model providers must be accessed through adapters behind the backend boundary.

The frontend must not call external API providers directly.

The rest of the runtime should depend on stable model interfaces, not on one provider implementation.

Context sent to an external API must be curated by local context governance.

Model output is data. It must not directly update memory, identity, policy, or local data. Model providers are replaceable fast variables.

---

## 8. Memory and Context

Memory is a slow-variable system.

Memory-related code must preserve:

- review before long-term acceptance;
- bounded context injection;
- accepted-memory filtering;
- privacy;
- traceability;
- deterministic tests where practical.

Context assembly is high-risk because it controls what the model sees.

---

## 9. Profiles and Identity

Profile and identity records represent slow variables.

They may include:

- owner model;
- AI identity model;
- state-related records;
- communication preferences;
- long-term project context.

They must not be overwritten directly by model output.

---

## 10. Storage and Database

Local persistence may include:

- conversation records;
- memory records;
- profile files;
- identity files;
- state files;
- diagnostic records;
- local configuration.

Local data must remain untracked by Git.

Schema changes must preserve existing owner data.

---

## 11. Diagnostics and Trace

Diagnostics should make runtime behavior understandable without exposing private data.

Diagnostics may expose:

- adapter status;
- safe metadata;
- check results;
- database status;
- memory status;
- context budget metadata;
- error categories.

Diagnostics must not expose secrets, API keys, full private prompts, raw memory content, or private local data by default.

---

## 12. Body / Live2D Boundary

The body layer is a replaceable future embodiment boundary.

Live2D is not:

- identity;
- memory;
- reasoning;
- policy;
- persistence.

Core runtime must not depend on Live2D.

Real Cubism .moc3 loading and complete Live2D behavior are not active scope unless explicitly reopened.

---

## 13. Architecture Invariants

Do not violate these invariants:

- RIN remains local-state-first.
- RIN remains single-owner.
- Chat reasoning is external API only; local models are reserved for future non-chat features.
- Model providers remain replaceable fast variables.
- UI does not directly call model providers (local or external).
- Frontend must not call external API providers directly.
- Context sent to external APIs must be curated by local context governance.
- Model output does not directly write memory, identity, policy, or local data.
- Slow variables remain locally governed.
- Local data remains protected.
- Secrets are never committed.
- Module boundaries remain clear.
- Removed or inactive systems remain out of active scope unless explicitly reopened.