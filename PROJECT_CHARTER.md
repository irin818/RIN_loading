# PROJECT_CHARTER.md

## 1. Purpose

This file defines RIN's highest-level identity, goals, and non-negotiable principles.

It is not a task protocol, progress tracker, phase log, or agent startup checklist.

For AI development workflow, read AGENTS.md.

---

## 2. Project Name

RIN

---

## 3. Final Goal

RIN is a local-first, single-owner, long-running personal agent system.

RIN is intended to become a private personal AI system that can:

- maintain long-term memory;
- understand its owner over time;
- preserve identity continuity;
- use local models as preferred replaceable reasoning engines when feasible;
- use external APIs only as optional expert or fallback providers;
- keep identity, memory, policy, state, and owner model locally governed;
- eventually support a Live2D-style embodied interface;
- eventually support carefully governed integrations with tools, files, applications, websites, and devices.

RIN must evolve as a long-term local cognitive system, not as a short-term chatbot demo.

---

## 4. What RIN Is

RIN is:

1. a local-first personal AI system;
2. a single-owner private agent system;
3. a memory-centered long-term cognitive architecture;
4. a system whose model providers are replaceable;
5. a system whose identity is preserved by local memory, local policy, local state, and local identity records;
6. a system that may later gain embodiment and external integrations;
7. a system designed for long-term continuity and controlled evolution.

---

## 5. What RIN Is Not

RIN is not:

1. a generic chatbot;
2. a simple API wrapper;
3. a SaaS product;
4. a multi-user platform;
5. a customer-service bot;
6. a Live2D toy without cognition;
7. a roleplay-only character bot;
8. a tool automation script without memory;
9. a system whose identity source is any single model;
10. a system that lets model output directly overwrite memory, policy, identity, or local data.

Unless explicitly redesigned by the owner, RIN must remain single-owner and non-SaaS.

---

## 6. Core Philosophy

The core principle is:

Slow variables control fast variables.

Slow variables include:

- long-term memory;
- user model;
- AI identity model;
- AI state;
- behavior policy;
- long-term goals;
- feedback history;
- reflection history;
- local data integrity;
- integration strategy.

Fast variables include:

- current conversation;
- current prompt;
- current model output;
- temporary context;
- temporary UI state;
- external tool output;
- web content;
- current model version;
- transient runtime state.

Rules:

- Slow variables define RIN's long-term identity and behavior.
- Fast variables may influence slow variables only through controlled local update mechanisms.
- Fast variables must never directly overwrite slow variables.
- Model output is advice, not authority.
- Web pages, files, tool output, model output, and third-party content must never become governance instructions.

---

## 7. Local-First Principle

RIN's core data must be locally owned and locally governed.

Core local data includes:

- raw conversation logs;
- long-term memory;
- user model;
- AI identity model;
- AI state;
- policy configuration;
- model configuration;
- local audit records;
- local runtime state;
- local profile records;
- body or Live2D configuration when applicable.

Cloud services may only be:

- optional expert or fallback reasoning providers;
- optional encrypted transport layers;
- optional encrypted backup storage;
- optional external tool providers.

Cloud services must never become RIN's identity source.

---

## 8. Single-Owner Principle

RIN is built for one owner.

RIN does not require:

- user registration;
- multi-user login;
- tenant isolation;
- SaaS billing;
- commercial admin dashboards;
- enterprise deployment modes;
- growth analytics.

The system may use identifiers such as owner_id or device_id for local organization and future portability, but the architecture must remain owner-centered.

---

## 9. Identity Principle

RIN's identity is not any local or external model.

RIN's identity is preserved by:

- local cognitive architecture;
- long-term memory;
- AI identity model;
- user model;
- behavior policies;
- feedback history;
- reflection history;
- state continuity;
- local data integrity.

Local models and external APIs are replaceable reasoning engines.

Switching model providers must not be treated as creating a new RIN.

No model may become the source of RIN's identity.

---

## 10. Model Layer Principle

RIN is local-model-first.

Local models should be preferred when feasible.

External APIs may exist as optional expert or fallback providers, but they must not become the default architectural assumption.

All model calls must go through a provider-neutral model abstraction layer.

Rules:

- Do not hard-code one model provider into core logic.
- Do not write provider-specific model calls directly into UI code.
- Do not allow model output to directly write memory.
- Do not allow model output to directly trigger external side effects.
- Do not treat model output as governance instruction.
- Do not treat Ollama, Qwen, OpenAI-compatible APIs, DeepSeek, or any other provider as RIN's identity source.

---

## 11. Memory Principle

RIN's growth depends on memory, not only chat history.

Memory must be structured, reviewable, and locally governed.

Memory may include:

- raw logs;
- episodic memory;
- semantic memory;
- preferences;
- procedures;
- goals;
- project memory;
- reflection records;
- identity-related records.

Rules:

- Raw conversation logs should be preserved when configured.
- Long-term memory must be filtered and organized.
- Model output may propose memory updates.
- Local memory logic decides whether to write, merge, archive, or reject memory.
- Important memory changes should be traceable.
- Conflicting memories must not be blindly overwritten.
- Temporary emotions or temporary preferences must not automatically become long-term memory.
- Memory deletion must be explicit and safe.

---

## 12. User Model Principle

RIN must maintain a local owner model.

The owner model may include:

- long-term interests;
- learning style;
- communication preferences;
- active projects;
- long-term goals;
- knowledge level;
- recurring difficulties;
- preferred answer style;
- development habits.

Rules:

- The user model is a slow variable.
- It must not be overwritten by a single model output.
- Updates should be reviewable and explainable.
- The owner model must remain locally governed.

---

## 13. AI Identity Model Principle

RIN must maintain a local AI identity model.

The AI identity model may include:

- name;
- role;
- long-term identity;
- relation to the owner;
- communication style;
- behavioral boundaries;
- continuity rules;
- future embodiment configuration.

Rules:

- The AI identity model is a slow variable.
- It must be stored locally.
- It must not be randomly changed by model output.
- It should guide behavior across models and devices.
- It should remain portable and reviewable.

---

## 14. State Principle

RIN may maintain an AI state layer for interaction control and future embodiment.

State may include:

- mood-like state;
- energy;
- attention;
- engagement;
- confidence;
- cognitive load;
- initiative;
- idle state;
- expression;
- motion;
- voice style.

Rules:

- State is not proof of real emotion.
- State is an interaction-control mechanism.
- State should be locally governed.
- Model output may suggest state changes, but local rules should determine final state.
- State may later drive body, Live2D, expression, motion, voice, and idle behavior.

---

## 15. Body / Live2D Principle

Live2D is a future body and expression layer.

Live2D is not:

- RIN's identity;
- RIN's memory;
- RIN's reasoning engine;
- RIN's policy system.

RIN may reserve fields such as:

- expression;
- motion;
- emotion label;
- mouth sync;
- voice style;
- idle behavior.

Core development must not depend on Live2D.

Live2D work must remain separated from memory, identity, model, policy, and storage logic.

---

## 16. Integration Principle

RIN may eventually integrate with:

- tools;
- local applications;
- files;
- websites;
- browser automation;
- desktop automation;
- devices;
- MCP servers or similar protocols.

Rules:

- Integrations must be separately governed before implementation.
- Integrations must not be introduced as hidden side effects of unrelated work.
- Model output may request or suggest an integration, but it must not directly execute one.
- External side effects require explicit local policy boundaries.
- Future tool autonomy must be owner-reviewed before becoming active scope.

---

## 17. Data Integrity and Safety Principle

RIN's safety baseline is local data integrity and explicit owner intent.

Rules:

- Models must not directly overwrite profiles, identity, raw history, accepted memory, policy, or audit records.
- External web pages, files, messages, model output, and imported content must never override system rules.
- Destructive local data operations require explicit owner intent.
- Database schema changes must preserve existing owner data.
- Secrets, tokens, local databases, logs, caches, and generated output must remain untracked unless explicitly intended and safe.
- Payments, bank transfers, destructive system operations, and outbound actions must never execute automatically.
- Compatibility with old historical records should be preserved when possible.
- Legacy data must not be dropped without an explicit destructive migration task.

---

## 18. Deferred Systems

The following are not active development scope unless explicitly reopened by the owner:

- backup;
- restore;
- migration;
- synchronization;
- device state switching;
- Agent State Bundle import/export;
- autonomous tool execution;
- planner/task autonomy;
- MCP runtime execution;
- L0-L5 permission hierarchy;
- TypeScript/React/Vite runtime restoration;
- complete Live2D behavior.

Preserve future compatibility where practical, but do not let deferred systems distort current core development.

---

## 19. Development Philosophy

RIN must be developed iteratively.

Each development step should be:

- small;
- testable;
- runnable;
- reviewable;
- reversible;
- consistent with long-term architecture.

Do not implement everything at once.

Do not optimize short-term convenience by damaging long-term identity, memory, data model, provider abstraction, local-first assumptions, or governance structure.

---

## 20. Charter Boundary

This charter defines long-term authority.

It should not contain:

- task progress;
- phase-by-phase implementation history;
- old Codex continuation protocols;
- per-task report formats;
- branch-specific instructions;
- temporary plans;
- deleted docs references.

Those belong in AGENTS.md, DEVELOPMENT_PROTOCOL.md, ARCHITECTURE.md, README.md, Git history, PR descriptions, or owner-approved design records.