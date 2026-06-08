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

RIN is currently a Python-first local runtime.

Active runtime stack:

- Python package: python/src/rin/
- Tests: python/tests/
- Local server: FastAPI
- Templates: Jinja2
- UI assets: static CSS/JavaScript
- Persistence: local SQLite and local files
- Model access: provider-neutral adapter layer
- Launcher: Start_RIN.command

There is no active TypeScript/React/Vite runtime.

---

## 3. High-Level Data Flow

Current runtime flow:

```text
Browser UI
  -> FastAPI server
  -> conversation runtime
  -> context assembly
  -> model adapter
  -> response validation
  -> persistence
  -> diagnostics / trace
```

Key rule:

The UI must not directly call model providers or directly write long-term memory.

---

## 4. Module Boundaries

| Path | Responsibility |
|---|---|
| python/src/rin/server/ | FastAPI routes, local UI, templates, static files |
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

The server/UI layer presents local runtime state and accepts owner interaction.

It may:

- serve local pages;
- expose safe runtime status;
- submit chat/test requests;
- display diagnostics;
- call internal server routes.

It must not:

- call model providers directly;
- write long-term memory directly;
- own identity, policy, or persistence logic;
- expose secrets or private raw data by default.

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

Model providers must be accessed through adapters.

The rest of the runtime should depend on stable model interfaces, not on one provider implementation.

Model output is data. It must not directly update memory, identity, policy, or local data.

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

- RIN remains local-first.
- RIN remains single-owner.
- Model providers remain replaceable.
- UI does not directly call model providers.
- Model output does not directly write memory, identity, policy, or local data.
- Slow variables remain locally governed.
- Local data remains protected.
- Secrets are never committed.
- Module boundaries remain clear.
- Removed or inactive systems remain out of active scope unless explicitly reopened.